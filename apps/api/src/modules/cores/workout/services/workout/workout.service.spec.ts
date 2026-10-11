import { newDb, IMemoryDb } from 'pg-mem';
import { DataSource, QueryFailedError } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { WorkoutService } from './workout.service';
import { WorkoutEntryEntity } from '../../entities/workout-entry.entity';
import { WorkoutSetEntity } from '../../entities/workout-set.entity';
import { WorkoutSetAlreadyExistsException } from '../../exceptions/workout-set-already-exists.exception';
import { CreateWorkoutOptions } from '../../../../../models/options/create-workout-options';
import { ITimeContext } from '../../../../../common/time-context/time-context.interface';

/** Deterministic fake clock so `created_time` is assertable. */
class FakeTimeContext implements ITimeContext {
  public constructor(private readonly __now: Date) {}
  public getUtcNowAsync(): Promise<Date> {
    return Promise.resolve(this.__now);
  }
}

const FIXED_NOW = new Date('2026-10-10T08:30:00.000Z');
const PERFORMED_AT = new Date('2026-10-09T18:00:00.000Z');
const USER_ID = '018f6b0a-0000-7000-8000-000000000001';
const EXERCISE_A = '018f6b0a-0000-7000-8000-0000000000a1';
const EXERCISE_B = '018f6b0a-0000-7000-8000-0000000000b1';

async function createInMemoryDataSource(): Promise<DataSource> {
  const db: IMemoryDb = newDb();

  db.public.registerFunction({ name: 'version', implementation: () => 'PostgreSQL 14.0 (pg-mem)' });
  db.public.registerFunction({ name: 'current_database', implementation: () => 'test' });

  // Raw DDL mirroring the CreateWorkoutTables migration. The (user_id, exercise_id, performed_at,
  // set_number) UNIQUE constraint is included (the duplicate/rollback tests depend on it); the PR
  // expression indexes are omitted (not needed for logging correctness; pg-mem cannot parse computed
  // CREATE INDEX). The real Postgres migration keeps all indexes.
  db.public.none(`
    CREATE TABLE workout_entries (
      id uuid NOT NULL,
      user_id uuid NOT NULL,
      exercise_id uuid NOT NULL,
      performed_at timestamptz NOT NULL,
      created_time timestamptz NOT NULL,
      CONSTRAINT pk_workout_entries PRIMARY KEY (id)
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
        UNIQUE (user_id, exercise_id, performed_at, set_number)
    );
  `);

  const dataSource: DataSource = db.adapters.createTypeormDataSource({
    type: 'postgres',
    entities: [WorkoutEntryEntity, WorkoutSetEntity],
  });

  await dataSource.initialize();

  return dataSource;
}

function singleEntryOptions(): CreateWorkoutOptions {
  return {
    userId: USER_ID,
    entries: [
      {
        exerciseId: EXERCISE_A,
        performedAt: PERFORMED_AT,
        sets: [
          { setNumber: 1, reps: 8, weight: 100, unit: 'kg', weightKg: 100 },
          { setNumber: 2, reps: 6, weight: 110, unit: 'kg', weightKg: 110 },
        ],
      },
    ],
  };
}

describe('WorkoutService', () => {
  let dataSource: DataSource;
  let service: WorkoutService;

  beforeEach(async () => {
    dataSource = await createInMemoryDataSource();
    service = new WorkoutService(
      dataSource,
      dataSource.getRepository(WorkoutEntryEntity),
      dataSource.getRepository(WorkoutSetEntity),
      new FakeTimeContext(FIXED_NOW),
    );
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  //#region createManyAsync
  describe('createManyAsync', () => {
    it('persists a parent entry and one row per set with the correct set_number, weight_kg, and created_time', async () => {
      const [entry] = await service.createManyAsync(singleEntryOptions());

      expect(entry.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(entry.userId).toBe(USER_ID);
      expect(entry.exerciseId).toBe(EXERCISE_A);
      expect(entry.performedAt).toEqual(PERFORMED_AT);
      expect(entry.createdTime).toEqual(FIXED_NOW);
      expect(entry.sets).toHaveLength(2);

      const entryRows = await dataSource.getRepository(WorkoutEntryEntity).find();
      const setRows = await dataSource
        .getRepository(WorkoutSetEntity)
        .find({ order: { setNumber: 'ASC' } });
      expect(entryRows).toHaveLength(1);
      expect(setRows).toHaveLength(2);
      expect(setRows.map((s) => s.setNumber)).toEqual([1, 2]);
      expect(setRows[0].weightKg).toBe(100);
      expect(setRows[1].weightKg).toBe(110);
      // Numeric transformer returns JS numbers, not strings.
      expect(typeof setRows[0].weight).toBe('number');
      expect(setRows[0].workoutEntryId).toBe(entry.id);
      expect(setRows.every((s) => s.createdTime.getTime() === FIXED_NOW.getTime())).toBe(true);
    });

    it('persists a bulk multi-exercise batch in one call (all parents + all sets)', async () => {
      const options: CreateWorkoutOptions = {
        userId: USER_ID,
        entries: [
          {
            exerciseId: EXERCISE_A,
            performedAt: PERFORMED_AT,
            sets: [{ setNumber: 1, reps: 5, weight: 60, unit: 'kg', weightKg: 60 }],
          },
          {
            exerciseId: EXERCISE_B,
            performedAt: PERFORMED_AT,
            sets: [
              { setNumber: 1, reps: 10, weight: 40, unit: 'kg', weightKg: 40 },
              { setNumber: 2, reps: 10, weight: 40, unit: 'kg', weightKg: 40 },
            ],
          },
        ],
      };

      const entries = await service.createManyAsync(options);

      expect(entries).toHaveLength(2);
      const entryRows = await dataSource.getRepository(WorkoutEntryEntity).find();
      const setRows = await dataSource.getRepository(WorkoutSetEntity).find();
      expect(entryRows).toHaveLength(2);
      expect(setRows).toHaveLength(3);
    });

    it('accepts two identical sets (same reps/weight) as distinct repeats via different set_number', async () => {
      const options: CreateWorkoutOptions = {
        userId: USER_ID,
        entries: [
          {
            exerciseId: EXERCISE_A,
            performedAt: PERFORMED_AT,
            sets: [
              { setNumber: 1, reps: 8, weight: 100, unit: 'kg', weightKg: 100 },
              { setNumber: 2, reps: 8, weight: 100, unit: 'kg', weightKg: 100 },
            ],
          },
        ],
      };

      const [entry] = await service.createManyAsync(options);

      expect(entry.sets).toHaveLength(2);
      const setRows = await dataSource.getRepository(WorkoutSetEntity).find();
      expect(setRows).toHaveLength(2);
    });

    it('throws WorkoutSetAlreadyExistsException for a true duplicate set (23505 on the unique key)', async () => {
      await service.createManyAsync(singleEntryOptions());

      await expect(service.createManyAsync(singleEntryOptions())).rejects.toBeInstanceOf(
        WorkoutSetAlreadyExistsException,
      );
    });

    it('wraps the WHOLE batch in a single transaction so a mid-batch failure aborts it all', async () => {
      // All-or-nothing is delegated to one DB transaction: the entire batch (both entries) runs
      // inside exactly ONE transaction() call, so any failure rolls the whole thing back. The
      // *rollback-writes-nothing* effect is DB-enforced and verified live against Postgres (pg-mem
      // does not implement transaction rollback — decision 4).
      const transactionSpy = jest.spyOn(dataSource, 'transaction');

      // Seed a conflicting set so the second entry of the batch collides on the unique key.
      await service.createManyAsync({
        userId: USER_ID,
        entries: [
          {
            exerciseId: EXERCISE_B,
            performedAt: PERFORMED_AT,
            sets: [{ setNumber: 1, reps: 5, weight: 50, unit: 'kg', weightKg: 50 }],
          },
        ],
      });
      transactionSpy.mockClear();

      const batch: CreateWorkoutOptions = {
        userId: USER_ID,
        entries: [
          {
            exerciseId: EXERCISE_A,
            performedAt: PERFORMED_AT,
            sets: [{ setNumber: 1, reps: 8, weight: 100, unit: 'kg', weightKg: 100 }],
          },
          {
            // Collides with the seeded set -> aborts the (single) transaction.
            exerciseId: EXERCISE_B,
            performedAt: PERFORMED_AT,
            sets: [{ setNumber: 1, reps: 5, weight: 50, unit: 'kg', weightKg: 50 }],
          },
        ],
      };

      await expect(service.createManyAsync(batch)).rejects.toBeInstanceOf(
        WorkoutSetAlreadyExistsException,
      );
      // Exactly one transaction wrapped the whole batch (not one per entry).
      expect(transactionSpy).toHaveBeenCalledTimes(1);
    });

    it('rethrows a non-23505 QueryFailedError unchanged (only unique violations are translated)', async () => {
      const otherError = new QueryFailedError('insert', [], { code: '23503' } as unknown as Error);
      jest.spyOn(dataSource, 'transaction').mockRejectedValueOnce(otherError as never);

      await expect(service.createManyAsync(singleEntryOptions())).rejects.toBe(otherError);
    });

    it('rethrows a generic (non-QueryFailedError) error unchanged', async () => {
      const genericError = new Error('connection lost');
      jest.spyOn(dataSource, 'transaction').mockRejectedValueOnce(genericError as never);

      await expect(service.createManyAsync(singleEntryOptions())).rejects.toBe(genericError);
    });
  });
  //#endregion

  //#region searchHistoryAsync
  describe('searchHistoryAsync', () => {
    // Entry ids are fixed and time-ordered (UUID v7-shaped) so keyset ordering + tiebreaks are
    // deterministic. Higher suffix = newer.
    const ENTRY_1 = '018f6b0a-0000-7000-8000-000000000001';
    const ENTRY_2 = '018f6b0a-0000-7000-8000-000000000002';
    const ENTRY_3 = '018f6b0a-0000-7000-8000-000000000003';
    const ENTRY_4 = '018f6b0a-0000-7000-8000-000000000004';
    const DAY_1 = new Date('2026-10-01T10:00:00.000Z');
    const DAY_2 = new Date('2026-10-02T10:00:00.000Z');
    const DAY_3 = new Date('2026-10-03T10:00:00.000Z');

    async function seedEntry(
      id: string,
      exerciseId: string,
      performedAt: Date,
      setCount = 1,
    ): Promise<void> {
      const entryRepository = dataSource.getRepository(WorkoutEntryEntity);
      const setRepository = dataSource.getRepository(WorkoutSetEntity);
      await entryRepository.save(
        new WorkoutEntryEntity(id, USER_ID, exerciseId, performedAt, FIXED_NOW),
      );
      for (let n = 1; n <= setCount; n++) {
        await setRepository.save(
          new WorkoutSetEntity(
            uuidv7(),
            id,
            USER_ID,
            exerciseId,
            performedAt,
            n,
            8,
            100,
            'kg',
            100,
            FIXED_NOW,
          ),
        );
      }
    }

    it('returns entries in keyset order performed_at DESC, id DESC with their sets attached', async () => {
      await seedEntry(ENTRY_1, EXERCISE_A, DAY_1, 2);
      await seedEntry(ENTRY_2, EXERCISE_A, DAY_2);
      await seedEntry(ENTRY_3, EXERCISE_B, DAY_3);

      const page = await service.searchHistoryAsync({ userId: USER_ID, limit: 10 });

      expect(page.items.map((e) => e.id)).toEqual([ENTRY_3, ENTRY_2, ENTRY_1]);
      expect(page.hasMore).toBe(false);
      // Sets attached, ordered set_number ASC.
      const last = page.items[2];
      expect(last.sets).toHaveLength(2);
      expect(last.sets?.map((s) => s.setNumber)).toEqual([1, 2]);
    });

    it('first page returns exactly `limit` items and hasMore=true when more exist', async () => {
      await seedEntry(ENTRY_1, EXERCISE_A, DAY_1);
      await seedEntry(ENTRY_2, EXERCISE_A, DAY_2);
      await seedEntry(ENTRY_3, EXERCISE_A, DAY_3);

      const page = await service.searchHistoryAsync({ userId: USER_ID, limit: 2 });

      expect(page.items.map((e) => e.id)).toEqual([ENTRY_3, ENTRY_2]);
      expect(page.hasMore).toBe(true);
    });

    it('next page via cursor returns the following rows with no overlap', async () => {
      await seedEntry(ENTRY_1, EXERCISE_A, DAY_1);
      await seedEntry(ENTRY_2, EXERCISE_A, DAY_2);
      await seedEntry(ENTRY_3, EXERCISE_A, DAY_3);

      const nextPage = await service.searchHistoryAsync({
        userId: USER_ID,
        limit: 2,
        // Cursor positioned at ENTRY_2 (DAY_2): the next page should start at ENTRY_1 (DAY_1).
        cursor: { performedAt: DAY_2, id: ENTRY_2 },
      });

      expect(nextPage.items.map((e) => e.id)).toEqual([ENTRY_1]);
      expect(nextPage.hasMore).toBe(false);
    });

    it('tiebreaks by id DESC when performed_at is equal (stable ordering)', async () => {
      // Equal timestamps with the same exercise would collide on the denormalized set unique key,
      // so seed these ordering-only entries without sets.
      await seedEntry(ENTRY_1, EXERCISE_A, DAY_1, 0);
      await seedEntry(ENTRY_2, EXERCISE_A, DAY_1, 0);
      await seedEntry(ENTRY_3, EXERCISE_A, DAY_1, 0);

      const page = await service.searchHistoryAsync({ userId: USER_ID, limit: 10 });
      expect(page.items.map((e) => e.id)).toEqual([ENTRY_3, ENTRY_2, ENTRY_1]);

      // A cursor at the equal-timestamp middle row yields only the strictly-smaller id.
      const next = await service.searchHistoryAsync({
        userId: USER_ID,
        limit: 10,
        cursor: { performedAt: DAY_1, id: ENTRY_2 },
      });
      expect(next.items.map((e) => e.id)).toEqual([ENTRY_1]);
    });

    it('boundary: exactly `limit` rows available → hasMore=false', async () => {
      await seedEntry(ENTRY_1, EXERCISE_A, DAY_1);
      await seedEntry(ENTRY_2, EXERCISE_A, DAY_2);

      const page = await service.searchHistoryAsync({ userId: USER_ID, limit: 2 });

      expect(page.items).toHaveLength(2);
      expect(page.hasMore).toBe(false);
    });

    it('filters by exerciseIds (IN predicate)', async () => {
      await seedEntry(ENTRY_1, EXERCISE_A, DAY_1);
      await seedEntry(ENTRY_2, EXERCISE_B, DAY_2);
      await seedEntry(ENTRY_3, EXERCISE_A, DAY_3);

      const page = await service.searchHistoryAsync({
        userId: USER_ID,
        exerciseIds: [EXERCISE_A],
        limit: 10,
      });

      expect(page.items.map((e) => e.id)).toEqual([ENTRY_3, ENTRY_1]);
    });

    it('filters by date range (from/to, inclusive UTC)', async () => {
      await seedEntry(ENTRY_1, EXERCISE_A, DAY_1);
      await seedEntry(ENTRY_2, EXERCISE_A, DAY_2);
      await seedEntry(ENTRY_3, EXERCISE_A, DAY_3);

      const onlyFrom = await service.searchHistoryAsync({
        userId: USER_ID,
        from: DAY_2,
        limit: 10,
      });
      expect(onlyFrom.items.map((e) => e.id)).toEqual([ENTRY_3, ENTRY_2]);

      const onlyTo = await service.searchHistoryAsync({ userId: USER_ID, to: DAY_2, limit: 10 });
      expect(onlyTo.items.map((e) => e.id)).toEqual([ENTRY_2, ENTRY_1]);

      const bothBounds = await service.searchHistoryAsync({
        userId: USER_ID,
        from: DAY_2,
        to: DAY_2,
        limit: 10,
      });
      expect(bothBounds.items.map((e) => e.id)).toEqual([ENTRY_2]);
    });

    it('scopes to the requesting user only', async () => {
      const otherUser = '018f6b0a-0000-7000-8000-0000000000ff';
      await seedEntry(ENTRY_1, EXERCISE_A, DAY_1);
      await dataSource
        .getRepository(WorkoutEntryEntity)
        .save(new WorkoutEntryEntity(ENTRY_4, otherUser, EXERCISE_A, DAY_2, FIXED_NOW));

      const page = await service.searchHistoryAsync({ userId: USER_ID, limit: 10 });

      expect(page.items.map((e) => e.id)).toEqual([ENTRY_1]);
    });

    it('returns an empty page (not an error) for a known user with no rows', async () => {
      const page = await service.searchHistoryAsync({ userId: USER_ID, limit: 10 });

      expect(page.items).toEqual([]);
      expect(page.hasMore).toBe(false);
    });
  });
  //#endregion
});
