import { newDb, IMemoryDb } from 'pg-mem';
import { DataSource } from 'typeorm';
import { SeedService } from './seed.service';
import { UserEntity } from '../../../modules/cores/user/entities/user.entity';
import { ExerciseEntity } from '../../../modules/cores/exercise/entities/exercise.entity';
import { MuscleGroupEntity } from '../../../modules/cores/exercise/entities/muscle-group.entity';
import { ExerciseMuscleGroupEntity } from '../../../modules/cores/exercise/entities/exercise-muscle-group.entity';
import { WorkoutEntryEntity } from '../../../modules/cores/workout/entities/workout-entry.entity';
import { WorkoutSetEntity } from '../../../modules/cores/workout/entities/workout-set.entity';
import { UserService } from '../../../modules/cores/user/services/user/user.service';
import { ExerciseService } from '../../../modules/cores/exercise/services/exercise/exercise.service';
import { MuscleGroupService } from '../../../modules/cores/exercise/services/muscle-group/muscle-group.service';
import { ScaleUnitConversionService } from '../../../modules/cores/scale-unit/services/scale-unit-conversion/scale-unit-conversion.service';
import { ExerciseMuscleGroupAlreadyExistsException } from '../../../modules/cores/exercise/exceptions/exercise-muscle-group-already-exists.exception';
import { ITimeContext } from '../../../common/time-context/time-context.interface';

/** Deterministic clock so `performed_at`/`created_time` are assertable. */
class FakeTimeContext implements ITimeContext {
  public constructor(private readonly __now: Date) {}
  public getUtcNowAsync(): Promise<Date> {
    return Promise.resolve(this.__now);
  }
}

const FIXED_NOW = new Date('2026-10-10T08:30:00.000Z');
const POUND_FACTOR = 0.45359237;

async function createInMemoryDataSource(): Promise<DataSource> {
  const db: IMemoryDb = newDb();

  db.public.registerFunction({ name: 'version', implementation: () => 'PostgreSQL 14.0 (pg-mem)' });
  db.public.registerFunction({ name: 'current_database', implementation: () => 'test' });

  // Raw DDL mirroring the migrations (columns + unique constraints + FKs used by the reset order).
  // The computed PR indexes are omitted (pg-mem cannot parse them); not needed for seed correctness.
  db.public.none(`
    CREATE TABLE users (
      id uuid NOT NULL,
      name varchar(200) NOT NULL,
      created_time timestamptz NOT NULL,
      updated_time timestamptz,
      CONSTRAINT pk_users PRIMARY KEY (id)
    );
    CREATE TABLE exercises (
      id uuid NOT NULL,
      name varchar(200) NOT NULL,
      created_time timestamptz NOT NULL,
      updated_time timestamptz,
      CONSTRAINT pk_exercises PRIMARY KEY (id),
      CONSTRAINT uq_exercises_name UNIQUE (name)
    );
    CREATE TABLE muscle_groups (
      id uuid NOT NULL,
      name varchar(200) NOT NULL,
      created_time timestamptz NOT NULL,
      updated_time timestamptz,
      CONSTRAINT pk_muscle_groups PRIMARY KEY (id),
      CONSTRAINT uq_muscle_groups_name UNIQUE (name)
    );
    CREATE TABLE exercise_muscle_groups (
      id uuid NOT NULL,
      exercise_id uuid NOT NULL,
      muscle_group_id uuid NOT NULL,
      created_time timestamptz NOT NULL,
      updated_time timestamptz,
      CONSTRAINT pk_exercise_muscle_groups PRIMARY KEY (id),
      CONSTRAINT uq_exercise_muscle_groups_exercise_id_muscle_group_id
        UNIQUE (exercise_id, muscle_group_id),
      CONSTRAINT fk_exercise_muscle_groups_exercise_id
        FOREIGN KEY (exercise_id) REFERENCES exercises (id),
      CONSTRAINT fk_exercise_muscle_groups_muscle_group_id
        FOREIGN KEY (muscle_group_id) REFERENCES muscle_groups (id)
    );
    CREATE TABLE workout_entries (
      id uuid NOT NULL,
      user_id uuid NOT NULL,
      exercise_id uuid NOT NULL,
      performed_at timestamptz NOT NULL,
      created_time timestamptz NOT NULL,
      CONSTRAINT pk_workout_entries PRIMARY KEY (id),
      CONSTRAINT fk_workout_entries_user_id FOREIGN KEY (user_id) REFERENCES users (id),
      CONSTRAINT fk_workout_entries_exercise_id FOREIGN KEY (exercise_id) REFERENCES exercises (id)
    );
    CREATE TABLE workout_sets (
      id uuid NOT NULL,
      workout_entry_id uuid NOT NULL,
      user_id uuid NOT NULL,
      exercise_id uuid NOT NULL,
      performed_at timestamptz NOT NULL,
      set_number smallint NOT NULL,
      reps integer NOT NULL,
      weight numeric(7,3) NOT NULL,
      unit varchar(8) NOT NULL,
      weight_kg numeric(9,4) NOT NULL,
      created_time timestamptz NOT NULL,
      CONSTRAINT pk_workout_sets PRIMARY KEY (id),
      CONSTRAINT uq_workout_sets_user_id_exercise_id_performed_at_set_number
        UNIQUE (user_id, exercise_id, performed_at, set_number),
      CONSTRAINT fk_workout_sets_workout_entry_id
        FOREIGN KEY (workout_entry_id) REFERENCES workout_entries (id)
    );
  `);

  const dataSource: DataSource = db.adapters.createTypeormDataSource({
    type: 'postgres',
    entities: [
      UserEntity,
      ExerciseEntity,
      MuscleGroupEntity,
      ExerciseMuscleGroupEntity,
      WorkoutEntryEntity,
      WorkoutSetEntity,
    ],
  });

  await dataSource.initialize();

  return dataSource;
}

describe('SeedService', () => {
  let dataSource: DataSource;
  let service: SeedService;
  let exerciseService: ExerciseService;

  beforeEach(async () => {
    dataSource = await createInMemoryDataSource();
    const timeContext = new FakeTimeContext(FIXED_NOW);

    const userService = new UserService(dataSource.getRepository(UserEntity), timeContext);
    const muscleGroupService = new MuscleGroupService(
      dataSource.getRepository(MuscleGroupEntity),
      timeContext,
    );
    exerciseService = new ExerciseService(
      dataSource.getRepository(ExerciseEntity),
      dataSource.getRepository(ExerciseMuscleGroupEntity),
      timeContext,
    );
    const scaleUnitConversionService = new ScaleUnitConversionService();

    service = new SeedService(
      dataSource,
      dataSource.getRepository(WorkoutEntryEntity),
      dataSource.getRepository(WorkoutSetEntity),
      dataSource.getRepository(ExerciseEntity),
      userService,
      exerciseService,
      muscleGroupService,
      scaleUnitConversionService,
      timeContext,
    );
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  describe('resetAsync', () => {
    it('clears every table to zero rows', async () => {
      const master = await service.seedMasterDataAsync();
      await service.seedWorkoutsAsync({ userId: master.demoUserId, count: 10, batchSize: 4 });

      await service.resetAsync();

      expect(await dataSource.getRepository(WorkoutSetEntity).count()).toBe(0);
      expect(await dataSource.getRepository(WorkoutEntryEntity).count()).toBe(0);
      expect(await dataSource.getRepository(ExerciseMuscleGroupEntity).count()).toBe(0);
      expect(await dataSource.getRepository(ExerciseEntity).count()).toBe(0);
      expect(await dataSource.getRepository(MuscleGroupEntity).count()).toBe(0);
      expect(await dataSource.getRepository(UserEntity).count()).toBe(0);
    });

    it('is a no-op on an already-empty database', async () => {
      await expect(service.resetAsync()).resolves.toBeUndefined();
      expect(await dataSource.getRepository(UserEntity).count()).toBe(0);
    });
  });

  describe('seedMasterDataAsync', () => {
    it('creates users, exercises, muscle groups and their unique mappings', async () => {
      const result = await service.seedMasterDataAsync();

      expect(result.userIds).toHaveLength(3);
      expect(result.exerciseIds).toHaveLength(10);
      expect(result.muscleGroupIds).toHaveLength(6);
      expect(result.mappingCount).toBe(17);

      expect(await dataSource.getRepository(UserEntity).count()).toBe(3);
      expect(await dataSource.getRepository(ExerciseEntity).count()).toBe(10);
      expect(await dataSource.getRepository(MuscleGroupEntity).count()).toBe(6);
      expect(await dataSource.getRepository(ExerciseMuscleGroupEntity).count()).toBe(17);
    });

    it('returns a demo user that exists in the users table', async () => {
      const result = await service.seedMasterDataAsync();

      expect(await dataSource.getRepository(UserEntity).existsBy({ id: result.demoUserId })).toBe(
        true,
      );
      expect(result.userIds).toContain(result.demoUserId);
    });

    it('creates only unique exercise↔muscle-group pairs', async () => {
      await service.seedMasterDataAsync();

      const mappings = await dataSource.getRepository(ExerciseMuscleGroupEntity).find();
      const pairs = new Set(mappings.map((m) => `${m.exerciseId}:${m.muscleGroupId}`));

      expect(pairs.size).toBe(mappings.length);
    });

    it('rejects a duplicate mapping with ExerciseMuscleGroupAlreadyExistsException', async () => {
      await service.seedMasterDataAsync();
      const [existing] = await dataSource.getRepository(ExerciseMuscleGroupEntity).find();

      await expect(
        exerciseService.mapMuscleGroupAsync(existing.exerciseId, existing.muscleGroupId),
      ).rejects.toThrow(ExerciseMuscleGroupAlreadyExistsException);
    });
  });

  describe('seedWorkoutsAsync', () => {
    it('generates row-per-set data with the expected row counts', async () => {
      const master = await service.seedMasterDataAsync();

      await service.seedWorkoutsAsync({ userId: master.demoUserId, count: 50, batchSize: 10 });

      // setsPerEntry = (i % 5) + 1 → 15 sets per block of 5 → 150 for 50 entries.
      expect(await dataSource.getRepository(WorkoutEntryEntity).count()).toBe(50);
      expect(await dataSource.getRepository(WorkoutSetEntity).count()).toBe(150);
    });

    it('normalizes weight_kg for both kg and lb original units', async () => {
      const master = await service.seedMasterDataAsync();
      await service.seedWorkoutsAsync({ userId: master.demoUserId, count: 50, batchSize: 10 });

      const setRepository = dataSource.getRepository(WorkoutSetEntity);
      const kgSet = await setRepository.findOne({ where: { unit: 'kg' } });
      const lbSet = await setRepository.findOne({ where: { unit: 'lb' } });

      if (kgSet === null || lbSet === null) {
        throw new Error('expected seeded sets for both kg and lb units');
      }
      expect(kgSet.weightKg).toBeCloseTo(kgSet.weight, 4);
      expect(lbSet.weightKg).toBeCloseTo(lbSet.weight * POUND_FACTOR, 3);
    });

    it('assigns distinct UTC performed_at per entry and 1-based set_number per entry', async () => {
      const master = await service.seedMasterDataAsync();
      await service.seedWorkoutsAsync({ userId: master.demoUserId, count: 50, batchSize: 10 });

      const entries = await dataSource.getRepository(WorkoutEntryEntity).find();
      const performedAtTimes = entries.map((entry) => entry.performedAt.getTime());
      expect(new Set(performedAtTimes).size).toBe(entries.length);

      // Pick an entry with multiple sets and verify its set numbers are distinct and 1-based.
      const sets = await dataSource.getRepository(WorkoutSetEntity).find();
      const multiSetEntry = entries.find(
        (entry) => sets.filter((set) => set.workoutEntryId === entry.id).length > 1,
      );
      if (multiSetEntry === undefined) {
        throw new Error('expected at least one entry with multiple sets');
      }
      const setNumbers = sets
        .filter((set) => set.workoutEntryId === multiSetEntry.id)
        .map((set) => set.setNumber)
        .sort((a, b) => a - b);
      expect(setNumbers).toEqual(Array.from({ length: setNumbers.length }, (_, i) => i + 1));
    });

    it('inserts the exact total when count is not a multiple of the batch size', async () => {
      const master = await service.seedMasterDataAsync();

      await service.seedWorkoutsAsync({ userId: master.demoUserId, count: 7, batchSize: 5 });

      // setsPerEntry sum for i=0..6: (1+2+3+4+5)+(1+2) = 18.
      expect(await dataSource.getRepository(WorkoutEntryEntity).count()).toBe(7);
      expect(await dataSource.getRepository(WorkoutSetEntity).count()).toBe(18);
    });

    it('throws when the target user does not exist', async () => {
      await expect(
        service.seedWorkoutsAsync({
          userId: '018f6b0a-0000-7000-8000-0000000000ff',
          count: 1,
          batchSize: 1,
        }),
      ).rejects.toThrow('does not exist');
    });

    it('throws when there are no exercises to seed against', async () => {
      // A user exists (passes the first guard) but no master-data exercises were seeded.
      const master = await service.seedMasterDataAsync();
      await dataSource.createQueryBuilder().delete().from(ExerciseMuscleGroupEntity).execute();
      await dataSource.createQueryBuilder().delete().from(ExerciseEntity).execute();

      await expect(
        service.seedWorkoutsAsync({ userId: master.demoUserId, count: 1, batchSize: 1 }),
      ).rejects.toThrow('no exercises');
    });
  });
});
