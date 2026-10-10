import { newDb, IMemoryDb } from 'pg-mem';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { ExerciseService } from './exercise.service';
import { ExerciseEntity } from '../../entities/exercise.entity';
import { MuscleGroupEntity } from '../../entities/muscle-group.entity';
import { ExerciseMuscleGroupEntity } from '../../entities/exercise-muscle-group.entity';
import { ExerciseByIdNotFoundException } from '../../exceptions/exercise-by-id-not-found.exception';
import { ExerciseMuscleGroupAlreadyExistsException } from '../../exceptions/exercise-muscle-group-already-exists.exception';
import { ITimeContext } from '../../../../../common/time-context/time-context.interface';

/**
 * Deterministic fake clock so `createAsync`/`mapMuscleGroupAsync` timestamps are assertable.
 */
class FakeTimeContext implements ITimeContext {
  public constructor(private readonly __now: Date) {}
  public getUtcNowAsync(): Promise<Date> {
    return Promise.resolve(this.__now);
  }
}

const FIXED_NOW = new Date('2026-10-10T08:30:00.000Z');
const MISSING_ID = '00000000-0000-7000-8000-000000000000';

async function createInMemoryDataSource(): Promise<DataSource> {
  const db: IMemoryDb = newDb();

  db.public.registerFunction({ name: 'version', implementation: () => 'PostgreSQL 14.0 (pg-mem)' });
  db.public.registerFunction({ name: 'current_database', implementation: () => 'test' });

  // Raw DDL mirroring the CreateExerciseCatalogue migration (pg-mem can't run TypeORM synchronize).
  db.public.none(`
    CREATE TABLE exercises (
      id uuid NOT NULL,
      name varchar(200) NOT NULL,
      created_time timestamptz NOT NULL,
      updated_time timestamptz NULL,
      CONSTRAINT pk_exercises PRIMARY KEY (id),
      CONSTRAINT uq_exercises_name UNIQUE (name)
    );
    CREATE TABLE muscle_groups (
      id uuid NOT NULL,
      name varchar(200) NOT NULL,
      created_time timestamptz NOT NULL,
      updated_time timestamptz NULL,
      CONSTRAINT pk_muscle_groups PRIMARY KEY (id),
      CONSTRAINT uq_muscle_groups_name UNIQUE (name)
    );
    CREATE TABLE exercise_muscle_groups (
      id uuid NOT NULL,
      exercise_id uuid NOT NULL,
      muscle_group_id uuid NOT NULL,
      created_time timestamptz NOT NULL,
      updated_time timestamptz NULL,
      CONSTRAINT pk_exercise_muscle_groups PRIMARY KEY (id),
      CONSTRAINT uq_exercise_muscle_groups_exercise_id_muscle_group_id UNIQUE (exercise_id, muscle_group_id)
    );
  `);

  const dataSource: DataSource = db.adapters.createTypeormDataSource({
    type: 'postgres',
    entities: [ExerciseEntity, MuscleGroupEntity, ExerciseMuscleGroupEntity],
  });

  await dataSource.initialize();

  return dataSource;
}

describe('ExerciseService', () => {
  let dataSource: DataSource;
  let exerciseRepository: Repository<ExerciseEntity>;
  let muscleGroupRepository: Repository<MuscleGroupEntity>;
  let mappingRepository: Repository<ExerciseMuscleGroupEntity>;
  let service: ExerciseService;

  beforeEach(async () => {
    dataSource = await createInMemoryDataSource();
    exerciseRepository = dataSource.getRepository(ExerciseEntity);
    muscleGroupRepository = dataSource.getRepository(MuscleGroupEntity);
    mappingRepository = dataSource.getRepository(ExerciseMuscleGroupEntity);
    service = new ExerciseService(
      exerciseRepository,
      mappingRepository,
      new FakeTimeContext(FIXED_NOW),
    );
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  async function seedMuscleGroup(name: string): Promise<MuscleGroupEntity> {
    return muscleGroupRepository.save(
      new MuscleGroupEntity(crypto.randomUUID(), name, FIXED_NOW),
    );
  }

  //#region createAsync
  describe('createAsync', () => {
    it('persists an exercise with a generated UUID v7 id, the name, and the clock timestamp', async () => {
      const created = await service.createAsync({ name: 'Bench Press' });

      expect(created.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(created.name).toBe('Bench Press');
      expect(created.createdTime).toEqual(FIXED_NOW);
      expect(created.updatedTime ?? null).toBeNull();

      const persisted = await exerciseRepository.findOneBy({ id: created.id });
      expect(persisted?.name).toBe('Bench Press');
    });
  });
  //#endregion

  //#region getByIdAsync
  describe('getByIdAsync', () => {
    it('returns the entity when it exists', async () => {
      const created = await service.createAsync({ name: 'Squat' });

      const found = await service.getByIdAsync(created.id);

      expect(found.id).toBe(created.id);
      expect(found.name).toBe('Squat');
    });

    it('throws ExerciseByIdNotFoundException when no exercise has the id', async () => {
      await expect(service.getByIdAsync(MISSING_ID)).rejects.toBeInstanceOf(
        ExerciseByIdNotFoundException,
      );
    });
  });
  //#endregion

  //#region existsByIdAsync
  describe('existsByIdAsync', () => {
    it('returns true when an exercise with the id exists', async () => {
      const created = await service.createAsync({ name: 'Deadlift' });

      await expect(service.existsByIdAsync(created.id)).resolves.toBe(true);
    });

    it('returns false when no exercise with the id exists', async () => {
      await expect(service.existsByIdAsync(MISSING_ID)).resolves.toBe(false);
    });
  });
  //#endregion

  //#region searchAsync
  describe('searchAsync', () => {
    it('returns items ordered by name ASC with the full total', async () => {
      await service.createAsync({ name: 'Squat' });
      await service.createAsync({ name: 'Bench Press' });
      await service.createAsync({ name: 'Deadlift' });

      const result = await service.searchAsync({ limit: 20, offset: 0 });

      expect(result.total).toBe(3);
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
      expect(result.items.map((exercise) => exercise.name)).toEqual([
        'Bench Press',
        'Deadlift',
        'Squat',
      ]);
    });

    // Note: exercise `name` is unique (uq_exercises_name), so equal names cannot coexist; the
    // `id ASC` secondary sort is a deterministic tie-break that is applied on every ordered query
    // above but cannot produce a visible difference here — so it is not separately asserted.

    it('respects limit (returns at most limit items; total is the full count)', async () => {
      await service.createAsync({ name: 'Squat' });
      await service.createAsync({ name: 'Bench Press' });
      await service.createAsync({ name: 'Deadlift' });

      const result = await service.searchAsync({ limit: 2, offset: 0 });

      expect(result.items).toHaveLength(2);
      expect(result.items.map((exercise) => exercise.name)).toEqual(['Bench Press', 'Deadlift']);
      expect(result.total).toBe(3);
    });

    it('respects offset (returns the correct slice)', async () => {
      await service.createAsync({ name: 'Squat' });
      await service.createAsync({ name: 'Bench Press' });
      await service.createAsync({ name: 'Deadlift' });

      const result = await service.searchAsync({ limit: 2, offset: 2 });

      expect(result.items.map((exercise) => exercise.name)).toEqual(['Squat']);
      expect(result.offset).toBe(2);
      expect(result.total).toBe(3);
    });

    it('returns empty items (not an error) for a page beyond the data, with the correct total', async () => {
      await service.createAsync({ name: 'Squat' });

      const result = await service.searchAsync({ limit: 20, offset: 50 });

      expect(result.items).toEqual([]);
      expect(result.total).toBe(1);
    });

    it('returns empty items with total 0 when no exercises exist (not an error)', async () => {
      const result = await service.searchAsync({ limit: 20, offset: 0 });

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('filters by partial, case-insensitive name', async () => {
      await service.createAsync({ name: 'Bench Press' });
      await service.createAsync({ name: 'Incline Bench' });
      await service.createAsync({ name: 'Squat' });

      const result = await service.searchAsync({ limit: 20, offset: 0, name: 'bench' });

      expect(result.total).toBe(2);
      expect(result.items.map((exercise) => exercise.name)).toEqual([
        'Bench Press',
        'Incline Bench',
      ]);
    });

    it('returns empty when the name filter matches nothing', async () => {
      await service.createAsync({ name: 'Squat' });

      const result = await service.searchAsync({ limit: 20, offset: 0, name: 'zzz' });

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('filters by muscleGroupId (only exercises mapped to that group)', async () => {
      const chest = await seedMuscleGroup('Chest');
      const legs = await seedMuscleGroup('Legs');
      const bench = await service.createAsync({ name: 'Bench Press' });
      const squat = await service.createAsync({ name: 'Squat' });
      await service.mapMuscleGroupAsync(bench.id, chest.id);
      await service.mapMuscleGroupAsync(squat.id, legs.id);

      const result = await service.searchAsync({ limit: 20, offset: 0, muscleGroupId: chest.id });

      expect(result.total).toBe(1);
      expect(result.items.map((exercise) => exercise.name)).toEqual(['Bench Press']);
    });

    it('returns empty when the muscleGroupId filter matches no mapping', async () => {
      const chest = await seedMuscleGroup('Chest');
      await service.createAsync({ name: 'Bench Press' });

      const result = await service.searchAsync({ limit: 20, offset: 0, muscleGroupId: chest.id });

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('includes each exercise\'s mapped muscle groups on the page', async () => {
      const chest = await seedMuscleGroup('Chest');
      const triceps = await seedMuscleGroup('Triceps');
      const bench = await service.createAsync({ name: 'Bench Press' });
      await service.mapMuscleGroupAsync(bench.id, chest.id);
      await service.mapMuscleGroupAsync(bench.id, triceps.id);

      const result = await service.searchAsync({ limit: 20, offset: 0 });

      const names = (result.items[0].exerciseMuscleGroups ?? [])
        .map((mapping) => mapping.muscleGroup?.name)
        .sort();
      expect(names).toEqual(['Chest', 'Triceps']);
    });
  });
  //#endregion

  //#region resolveIdsByNameLikeAsync
  describe('resolveIdsByNameLikeAsync', () => {
    it('returns the ids of exercises whose name partially matches', async () => {
      const bench = await service.createAsync({ name: 'Bench Press' });
      await service.createAsync({ name: 'Squat' });

      const ids = await service.resolveIdsByNameLikeAsync('bench');

      expect(ids).toEqual([bench.id]);
    });

    it('returns an empty array when nothing matches', async () => {
      await service.createAsync({ name: 'Squat' });

      await expect(service.resolveIdsByNameLikeAsync('zzz')).resolves.toEqual([]);
    });
  });
  //#endregion

  //#region resolveIdsByMuscleGroupIdAsync
  describe('resolveIdsByMuscleGroupIdAsync', () => {
    it('returns the ids of exercises mapped to the muscle group', async () => {
      const chest = await seedMuscleGroup('Chest');
      const bench = await service.createAsync({ name: 'Bench Press' });
      await service.mapMuscleGroupAsync(bench.id, chest.id);

      const ids = await service.resolveIdsByMuscleGroupIdAsync(chest.id);

      expect(ids).toEqual([bench.id]);
    });

    it('returns an empty array when nothing is mapped to the muscle group', async () => {
      const chest = await seedMuscleGroup('Chest');

      await expect(service.resolveIdsByMuscleGroupIdAsync(chest.id)).resolves.toEqual([]);
    });
  });
  //#endregion

  //#region mapMuscleGroupAsync
  describe('mapMuscleGroupAsync', () => {
    it('persists a mapping with a generated id and the clock timestamp', async () => {
      const chest = await seedMuscleGroup('Chest');
      const bench = await service.createAsync({ name: 'Bench Press' });

      const mapping = await service.mapMuscleGroupAsync(bench.id, chest.id);

      expect(mapping.exerciseId).toBe(bench.id);
      expect(mapping.muscleGroupId).toBe(chest.id);
      expect(mapping.createdTime).toEqual(FIXED_NOW);

      const persisted = await mappingRepository.findOneBy({ id: mapping.id });
      expect(persisted).not.toBeNull();
    });

    it('throws ExerciseMuscleGroupAlreadyExistsException for a duplicate (exercise, muscle group) pair', async () => {
      const chest = await seedMuscleGroup('Chest');
      const bench = await service.createAsync({ name: 'Bench Press' });
      await service.mapMuscleGroupAsync(bench.id, chest.id);

      await expect(service.mapMuscleGroupAsync(bench.id, chest.id)).rejects.toBeInstanceOf(
        ExerciseMuscleGroupAlreadyExistsException,
      );
    });

    it('rethrows a non-unique-violation QueryFailedError unchanged (only 23505 is translated)', async () => {
      const otherError = new QueryFailedError('insert', [], {
        code: '23503',
      } as unknown as Error);
      jest.spyOn(mappingRepository, 'save').mockRejectedValueOnce(otherError);

      await expect(service.mapMuscleGroupAsync('e', 'm')).rejects.toBe(otherError);
    });

    it('rethrows a generic (non-QueryFailedError) error unchanged', async () => {
      const genericError = new Error('connection lost');
      jest.spyOn(mappingRepository, 'save').mockRejectedValueOnce(genericError);

      await expect(service.mapMuscleGroupAsync('e', 'm')).rejects.toBe(genericError);
    });
  });
  //#endregion
});
