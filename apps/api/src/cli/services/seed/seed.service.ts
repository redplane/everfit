import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { ISeedService } from './seed-service.interface';
import { chunk } from './chunk';
import { SeedMasterDataResult } from '../../models/seed-master-data-result';
import { SeedWorkoutsOptions } from '../../models/seed-workouts-options';
import { WeightUnits } from '../../../modules/cores/scale-unit/constants/weight-units';
import { WorkoutEntryEntity } from '../../../modules/cores/workout/entities/workout-entry.entity';
import { WorkoutSetEntity } from '../../../modules/cores/workout/entities/workout-set.entity';
import { ExerciseEntity } from '../../../modules/cores/exercise/entities/exercise.entity';
import { ExerciseMuscleGroupEntity } from '../../../modules/cores/exercise/entities/exercise-muscle-group.entity';
import { MuscleGroupEntity } from '../../../modules/cores/exercise/entities/muscle-group.entity';
import { UserEntity } from '../../../modules/cores/user/entities/user.entity';
import { IUserService } from '../../../modules/cores/user/services/user/user-service.interface';
import { UserServiceInjectionTokens } from '../../../modules/cores/user/services/user/user-injection-tokens';
import { IExerciseService } from '../../../modules/cores/exercise/services/exercise/exercise-service.interface';
import { ExerciseServiceInjectionTokens } from '../../../modules/cores/exercise/services/exercise/exercise-injection-tokens';
import { IMuscleGroupService } from '../../../modules/cores/exercise/services/muscle-group/muscle-group-service.interface';
import { MuscleGroupServiceInjectionTokens } from '../../../modules/cores/exercise/services/muscle-group/muscle-group-injection-tokens';
import { IScaleUnitConversionService } from '../../../modules/cores/scale-unit/services/scale-unit-conversion/scale-unit-conversion-service.interface';
import { ScaleUnitConversionServiceInjectionTokens } from '../../../modules/cores/scale-unit/services/scale-unit-conversion/scale-unit-conversion-injection-tokens';
import { ITimeContext } from '../../../common/time-context/time-context.interface';
import { TimeContextInjectionTokens } from '../../../common/time-context/time-context-injection-tokens';

/** The demo users created by the master-data seed; the first is the designated demo user. */
const SEED_USER_NAMES = ['Demo Coach Client', 'Alice Johnson', 'Bob Smith'] as const;

/** The muscle-group catalogue. */
const SEED_MUSCLE_GROUPS = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'] as const;

/** The exercise catalogue and each exercise's muscle-group mapping (unique pairs by construction). */
const SEED_EXERCISES: ReadonlyArray<{ name: string; muscleGroups: string[] }> = [
  { name: 'Bench Press', muscleGroups: ['Chest', 'Arms'] },
  { name: 'Incline Bench Press', muscleGroups: ['Chest', 'Shoulders'] },
  { name: 'Squat', muscleGroups: ['Legs', 'Core'] },
  { name: 'Deadlift', muscleGroups: ['Back', 'Legs'] },
  { name: 'Overhead Press', muscleGroups: ['Shoulders', 'Arms'] },
  { name: 'Barbell Row', muscleGroups: ['Back', 'Arms'] },
  { name: 'Pull Up', muscleGroups: ['Back', 'Arms'] },
  { name: 'Bicep Curl', muscleGroups: ['Arms'] },
  { name: 'Plank', muscleGroups: ['Core'] },
  { name: 'Leg Press', muscleGroups: ['Legs'] },
];

/** Original units cycled through the generated sets so both the `kg` and `lb` paths are exercised. */
const SEED_UNITS: readonly string[] = [WeightUnits.KILOGRAM, WeightUnits.POUND];

/** Milliseconds between consecutive generated entries — spreads the dataset across months/years. */
const PERFORMED_AT_STEP_MS = 40 * 60 * 1_000;

@Injectable()
export class SeedService implements ISeedService {
  //#region Constructor
  public constructor(
    @InjectDataSource()
    private readonly __dataSource: DataSource,
    @InjectRepository(WorkoutEntryEntity)
    private readonly __entryRepository: Repository<WorkoutEntryEntity>,
    @InjectRepository(WorkoutSetEntity)
    private readonly __setRepository: Repository<WorkoutSetEntity>,
    @InjectRepository(ExerciseEntity)
    private readonly __exerciseRepository: Repository<ExerciseEntity>,
    @Inject(UserServiceInjectionTokens.SERVICE__USER)
    private readonly __userService: IUserService,
    @Inject(ExerciseServiceInjectionTokens.SERVICE__EXERCISE)
    private readonly __exerciseService: IExerciseService,
    @Inject(MuscleGroupServiceInjectionTokens.SERVICE__MUSCLE_GROUP)
    private readonly __muscleGroupService: IMuscleGroupService,
    @Inject(ScaleUnitConversionServiceInjectionTokens.SERVICE__SCALE_UNIT_CONVERSION)
    private readonly __scaleUnitConversionService: IScaleUnitConversionService,
    @Inject(TimeContextInjectionTokens.CONTEXT__TIME)
    private readonly __timeContext: ITimeContext,
  ) {}
  //#endregion

  //#region Methods
  public async resetAsync(): Promise<void> {
    // Data only — never the schema or the `migrations` table. TRUNCATE (not DELETE) so there are no
    // per-row FK re-validation triggers, which keeps a reset of 150k+ rows fast. Child-first order
    // with CASCADE per table: a bulk DELETE of parents would seq-scan the child tables once per row;
    // one `TRUNCATE ... CASCADE` per table avoids that entirely and works on both Postgres and the
    // in-memory test DB (pg-mem supports single-table TRUNCATE ... CASCADE, not multi-table).
    const orderedEntities = [
      WorkoutSetEntity,
      WorkoutEntryEntity,
      ExerciseMuscleGroupEntity,
      ExerciseEntity,
      MuscleGroupEntity,
      UserEntity,
    ];

    for (const entity of orderedEntities) {
      const { tableName } = this.__dataSource.getRepository(entity).metadata;
      await this.__dataSource.query(`TRUNCATE TABLE "${tableName}" CASCADE`);
    }
  }

  public async seedMasterDataAsync(): Promise<SeedMasterDataResult> {
    const users = await Promise.all(
      SEED_USER_NAMES.map((name) => this.__userService.createAsync({ name })),
    );

    const muscleGroups = await Promise.all(
      SEED_MUSCLE_GROUPS.map((name) => this.__muscleGroupService.createAsync({ name })),
    );
    const muscleGroupIdByName = new Map(muscleGroups.map((group) => [group.name, group.id]));

    let mappingCount = 0;
    const exerciseIds: string[] = [];
    for (const definition of SEED_EXERCISES) {
      const exercise = await this.__exerciseService.createAsync({ name: definition.name });
      exerciseIds.push(exercise.id);

      for (const muscleGroupName of definition.muscleGroups) {
        const muscleGroupId = muscleGroupIdByName.get(muscleGroupName);
        if (muscleGroupId === undefined) {
          throw new Error(`Seed misconfiguration: unknown muscle group "${muscleGroupName}".`);
        }

        await this.__exerciseService.mapMuscleGroupAsync(exercise.id, muscleGroupId);
        mappingCount += 1;
      }
    }

    return {
      userIds: users.map((user) => user.id),
      exerciseIds,
      muscleGroupIds: muscleGroups.map((group) => group.id),
      mappingCount,
      demoUserId: users[0].id,
    };
  }

  public async seedWorkoutsAsync(options: SeedWorkoutsOptions): Promise<void> {
    if (!(await this.__userService.existsByIdAsync(options.userId))) {
      throw new Error(`Cannot seed workouts: user "${options.userId}" does not exist.`);
    }

    const exercises = await this.__exerciseRepository.find();
    if (exercises.length === 0) {
      throw new Error('Cannot seed workouts: no exercises found. Seed master data first.');
    }

    const now = await this.__timeContext.getUtcNowAsync();
    const exerciseIds = exercises.map((exercise) => exercise.id);
    const factorByUnit = await this.__buildUnitFactorsAsync();

    const { entries, sets } = this.__generateRows(options, exerciseIds, factorByUnit, now);

    // Insert parents first (sets carry an FK to the entry), each in chunked multi-row INSERTs rather
    // than row-by-row, so 50k+ rows are written in O(count / batchSize) round-trips.
    for (const entryChunk of chunk(entries, options.batchSize)) {
      await this.__entryRepository.insert(entryChunk);
    }
    for (const setChunk of chunk(sets, options.batchSize)) {
      await this.__setRepository.insert(setChunk);
    }
  }
  //#endregion

  //#region Helpers
  /**
   * Pre-resolves the kg-normalization factor for each original unit via the conversion service (the
   * registry stays the single source of truth), so the per-set `weight_kg` is a cheap multiply rather
   * than a conversion call per generated row. `toBaseAsync(v, code)` is linear, so
   * `v * factor === toBaseAsync(v, code)`.
   */
  private async __buildUnitFactorsAsync(): Promise<Map<string, number>> {
    const factors = new Map<string, number>();
    for (const unit of SEED_UNITS) {
      factors.set(unit, await this.__scaleUnitConversionService.toBaseAsync(1, unit));
    }

    return factors;
  }

  /**
   * Generates the in-memory entry and set rows for the requested count. Each entry gets a strictly
   * decreasing UTC `performed_at` (unique per entry → the `(user_id, exercise_id, performed_at,
   * set_number)` key holds), a round-robin exercise, 1–5 sets with 1-based `set_number`, a mix of
   * `kg`/`lb` original units, and a `weight_kg` normalized from the pre-resolved factor.
   */
  private __generateRows(
    options: SeedWorkoutsOptions,
    exerciseIds: string[],
    factorByUnit: Map<string, number>,
    now: Date,
  ): { entries: WorkoutEntryEntity[]; sets: WorkoutSetEntity[] } {
    const entries: WorkoutEntryEntity[] = [];
    const sets: WorkoutSetEntity[] = [];

    for (let index = 0; index < options.count; index += 1) {
      const exerciseId = exerciseIds[index % exerciseIds.length];
      const performedAt = new Date(now.getTime() - index * PERFORMED_AT_STEP_MS);
      const entryId = uuidv7();

      entries.push(
        new WorkoutEntryEntity(entryId, options.userId, exerciseId, performedAt, now),
      );

      const setsPerEntry = (index % 5) + 1;
      for (let setNumber = 1; setNumber <= setsPerEntry; setNumber += 1) {
        const unit = SEED_UNITS[(index + setNumber) % SEED_UNITS.length];
        // `unit` is always one of SEED_UNITS, and `factorByUnit` is built from SEED_UNITS, so the
        // lookup is always present (non-null assertion — no unreachable default branch to cover).
        const factor = factorByUnit.get(unit) as number;
        const reps = 3 + ((index + setNumber) % 12);
        const weight = 20 + (index % 180) + setNumber * 2.5;
        const weightKg = weight * factor;

        sets.push(
          new WorkoutSetEntity(
            uuidv7(),
            entryId,
            options.userId,
            exerciseId,
            performedAt,
            setNumber,
            reps,
            weight,
            unit,
            weightKg,
            now,
          ),
        );
      }
    }

    return { entries, sets };
  }
  //#endregion
}
