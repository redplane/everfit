import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { newDb } from 'pg-mem';
import { DataSource } from 'typeorm';
import { UserEntity } from '../modules/cores/user/entities/user.entity';
import { ExerciseEntity } from '../modules/cores/exercise/entities/exercise.entity';
import { MuscleGroupEntity } from '../modules/cores/exercise/entities/muscle-group.entity';
import { ExerciseMuscleGroupEntity } from '../modules/cores/exercise/entities/exercise-muscle-group.entity';
import { WorkoutEntryEntity } from '../modules/cores/workout/entities/workout-entry.entity';
import { WorkoutSetEntity } from '../modules/cores/workout/entities/workout-set.entity';
import { TimeContextInjectionTokens } from '../common/time-context/time-context-injection-tokens';
import { ITimeContext } from '../common/time-context/time-context.interface';

const SEED_USER_ID = '018f6b0a-0000-7000-8000-000000000001';
const SEED_EXERCISE_ID = '018f6b0a-0000-7000-8000-0000000000a1';
const SEED_ENTRY_1_ID = '018f6b0a-0000-7000-8000-000000000b01';
const SEED_ENTRY_2_ID = '018f6b0a-0000-7000-8000-000000000b02';
const UNKNOWN_USER_ID = '018f6b0a-0000-7000-8000-0000000000ee';
const UNKNOWN_EXERCISE_ID = '018f6b0a-0000-7000-8000-0000000000ef';
const PR_EXERCISE_NO_SETS_ID = '018f6b0a-0000-7000-8000-0000000000a2';

/**
 * Bootstrap / wiring smoke test. It composes the REAL `AppModule` exactly as `main.ts` does
 * (global prefix `api`) and actually boots an HTTP listener, so it catches wiring defects that
 * provider-level unit tests cannot — e.g. an invalid module export (Nest `UnknownExportException`
 * fails `.compile()`) or a controller mounted at the wrong path.
 *
 * It stays hermetic by overriding the TypeORM DataSource with an in-memory pg-mem instance, so no
 * live Postgres is required in CI.
 */
async function createInMemoryDataSource(
  options: { seedWorkoutRefs?: boolean; seedHistory?: boolean; seedPersonalRecords?: boolean } = {},
): Promise<DataSource> {
  const db = newDb();

  db.public.registerFunction({
    name: 'version',
    implementation: () => 'PostgreSQL 14.0 (pg-mem)',
  });
  db.public.registerFunction({
    name: 'current_database',
    implementation: () => 'test',
  });

  db.public.none(`
    CREATE TABLE users (
      id uuid NOT NULL,
      name varchar(200) NOT NULL,
      created_time timestamptz NOT NULL,
      updated_time timestamptz NULL,
      CONSTRAINT pk_users PRIMARY KEY (id)
    );
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

  // Seed a user + exercise so the workout log route (F5) has valid references to log against. Gated
  // so the discovery-list tests (which assert empty totals) use an unseeded instance.
  if (options.seedWorkoutRefs) {
    db.public.none(`
      INSERT INTO users (id, name, created_time)
      VALUES ('${SEED_USER_ID}', 'Smoke User', now());
      INSERT INTO exercises (id, name, created_time)
      VALUES ('${SEED_EXERCISE_ID}', 'Bench Press', now());
    `);
  }

  // Seed a user, an exercise, and two history entries (each with a set) so the history route (F6)
  // returns a real cursor-paginated page. Uses a separate instance so it does not disturb the
  // empty-total discovery assertions above.
  if (options.seedHistory) {
    db.public.none(`
      INSERT INTO users (id, name, created_time)
      VALUES ('${SEED_USER_ID}', 'History User', now());
      INSERT INTO exercises (id, name, created_time)
      VALUES ('${SEED_EXERCISE_ID}', 'Bench Press', now());
      INSERT INTO workout_entries (id, user_id, exercise_id, performed_at, created_time)
      VALUES
        ('${SEED_ENTRY_1_ID}', '${SEED_USER_ID}', '${SEED_EXERCISE_ID}', '2026-10-01T10:00:00.000Z', now()),
        ('${SEED_ENTRY_2_ID}', '${SEED_USER_ID}', '${SEED_EXERCISE_ID}', '2026-10-02T10:00:00.000Z', now());
      INSERT INTO workout_sets
        (id, workout_entry_id, user_id, exercise_id, performed_at, set_number, reps, weight, unit, weight_kg, created_time)
      VALUES
        ('018f6b0a-0000-7000-8000-000000000c01', '${SEED_ENTRY_1_ID}', '${SEED_USER_ID}', '${SEED_EXERCISE_ID}', '2026-10-01T10:00:00.000Z', 1, 8, 100, 'kg', 100, now()),
        ('018f6b0a-0000-7000-8000-000000000c02', '${SEED_ENTRY_2_ID}', '${SEED_USER_ID}', '${SEED_EXERCISE_ID}', '2026-10-02T10:00:00.000Z', 1, 5, 120, 'kg', 120, now());
    `);
  }

  // Seed a user + an exercise with a few sets (distinct winners for each metric) plus a second
  // exercise with NO sets, so the personal-record route (F7) can be probed end to end: a happy path,
  // the empty-not-error case (known exercise, no sets -> null metrics), and the unknown-exercise 404.
  if (options.seedPersonalRecords) {
    db.public.none(`
      INSERT INTO users (id, name, created_time)
      VALUES ('${SEED_USER_ID}', 'PR User', now());
      INSERT INTO exercises (id, name, created_time)
      VALUES
        ('${SEED_EXERCISE_ID}', 'Bench Press', now()),
        ('${PR_EXERCISE_NO_SETS_ID}', 'Deadlift', now());
      INSERT INTO workout_entries (id, user_id, exercise_id, performed_at, created_time)
      VALUES
        ('${SEED_ENTRY_1_ID}', '${SEED_USER_ID}', '${SEED_EXERCISE_ID}', '2026-10-01T10:00:00.000Z', now()),
        ('${SEED_ENTRY_2_ID}', '${SEED_USER_ID}', '${SEED_EXERCISE_ID}', '2026-10-02T10:00:00.000Z', now());
      INSERT INTO workout_sets
        (id, workout_entry_id, user_id, exercise_id, performed_at, set_number, reps, weight, unit, weight_kg, created_time)
      VALUES
        ('018f6b0a-0000-7000-8000-000000000d01', '${SEED_ENTRY_1_ID}', '${SEED_USER_ID}', '${SEED_EXERCISE_ID}', '2026-10-01T10:00:00.000Z', 1, 2, 130, 'kg', 130, now()),
        ('018f6b0a-0000-7000-8000-000000000d02', '${SEED_ENTRY_2_ID}', '${SEED_USER_ID}', '${SEED_EXERCISE_ID}', '2026-10-02T10:00:00.000Z', 1, 12, 90, 'kg', 90, now());
    `);
  }

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

describe('AppModule (bootstrap smoke)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let baseUrl: string;

  beforeAll(async () => {
    // Satisfy boot-time env validation hermetically (do not depend on a local .env.api).
    process.env.NODE_ENV = 'test';
    process.env.DATABASE__HOST = 'localhost';
    process.env.DATABASE__USERNAME = 'test';
    process.env.DATABASE__PASSWORD = 'test';
    process.env.DATABASE__NAME = 'test';
    process.env.API_DOCUMENT__ENABLED = 'false';

    dataSource = await createInMemoryDataSource();

    const { AppModule } = await import('./app.module');

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(getDataSourceToken())
      .useValue(dataSource)
      .compile();

    app = moduleRef.createNestApplication();
    // Mirror main.ts: the global prefix is applied here, not in the controller path.
    app.setGlobalPrefix('api');
    await app.init();
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    // `app.close()` already tears down the Nest-managed DataSource; only destroy it here if it
    // somehow survived (e.g. the app failed to init).
    await app?.close();
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('boots the real AppModule and serves the user list at /api/users', async () => {
    const response = await fetch(`${baseUrl}/api/users`);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.total).toBe(0);
    expect('limit' in body).toBe(false);
    expect('offset' in body).toBe(false);
  });

  it('serves the get-user-by-id route at /api/users/:id (404 for an unknown id)', async () => {
    const response = await fetch(`${baseUrl}/api/users/00000000-0000-7000-8000-000000000000`);

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.code).toBe('USER_NOT_FOUND');
  });

  it('does NOT mount the double-prefixed path /api/api/users', async () => {
    const response = await fetch(`${baseUrl}/api/api/users`);

    expect(response.status).toBe(404);
  });

  it('boots and serves the exercise list at /api/exercises', async () => {
    const response = await fetch(`${baseUrl}/api/exercises`);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.total).toBe(0);
    expect('limit' in body).toBe(false);
    expect('offset' in body).toBe(false);
  });

  it('serves the muscle-group list at /api/muscle-groups', async () => {
    const response = await fetch(`${baseUrl}/api/muscle-groups`);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.total).toBe(0);
    expect('limit' in body).toBe(false);
    expect('offset' in body).toBe(false);
  });

  it('does NOT mount the double-prefixed paths /api/api/exercises or /api/api/muscle-groups', async () => {
    const exercisesResponse = await fetch(`${baseUrl}/api/api/exercises`);
    const muscleGroupsResponse = await fetch(`${baseUrl}/api/api/muscle-groups`);

    expect(exercisesResponse.status).toBe(404);
    expect(muscleGroupsResponse.status).toBe(404);
  });
});

/**
 * Workout logging (F5) boots its own app over a separately seeded in-memory DataSource (a user +
 * exercise to log against), so it does not disturb the empty-total assertions above. Proves the real
 * module graph composes the controller → logging orchestration → core workout/user/exercise/scale-unit
 * services and the kg-normalization chain, and that the route is mounted at /api/workout.
 */
describe('AppModule (bootstrap smoke) — workout logging (F5)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE__HOST = 'localhost';
    process.env.DATABASE__USERNAME = 'test';
    process.env.DATABASE__PASSWORD = 'test';
    process.env.DATABASE__NAME = 'test';
    process.env.API_DOCUMENT__ENABLED = 'false';

    dataSource = await createInMemoryDataSource({ seedWorkoutRefs: true });

    const { AppModule } = await import('./app.module');

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(getDataSourceToken())
      .useValue(dataSource)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app?.close();
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  function postWorkout(body: unknown): Promise<Response> {
    return fetch(`${baseUrl}/api/workout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('logs a valid single workout at POST /api/workout (201) as row-per-set records', async () => {
    const response = await postWorkout({
      userId: SEED_USER_ID,
      entries: [
        {
          exerciseId: SEED_EXERCISE_ID,
          performedAt: '2026-10-09T18:00:00.000Z',
          sets: [
            { reps: 8, weight: 100, unit: 'kg' },
            { reps: 8, weight: 220, unit: 'lb' },
          ],
        },
      ],
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0].sets).toHaveLength(2);
    expect(body.entries[0].sets.map((s: { setNumber: number }) => s.setNumber)).toEqual([1, 2]);
    // lb set normalized to kg (220 * 0.45359237 ≈ 99.79).
    expect(body.entries[0].sets[1].weightKg).toBeCloseTo(99.79, 1);
  });

  it('returns 400 for an invalid body (empty entries)', async () => {
    const response = await postWorkout({ userId: SEED_USER_ID, entries: [] });

    expect(response.status).toBe(400);
  });

  it('does NOT mount the double-prefixed path /api/api/workout', async () => {
    const doublePrefixed = await fetch(`${baseUrl}/api/api/workout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: SEED_USER_ID, entries: [] }),
    });

    expect(doublePrefixed.status).toBe(404);
  });
});

/**
 * Workout history (F6) boots its own app over a seeded in-memory DataSource (a user + exercise + two
 * entries with sets), proving the real module graph composes the controller → history-query
 * orchestration → core user/exercise/scale-unit/workout services, that the route is mounted at
 * /api/workout-history, that the keyset cursor pages correctly, and that the required-unit and
 * unknown-user rules hold end to end.
 */
describe('AppModule (bootstrap smoke) — workout history (F6)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE__HOST = 'localhost';
    process.env.DATABASE__USERNAME = 'test';
    process.env.DATABASE__PASSWORD = 'test';
    process.env.DATABASE__NAME = 'test';
    process.env.API_DOCUMENT__ENABLED = 'false';

    dataSource = await createInMemoryDataSource({ seedHistory: true });

    const { AppModule } = await import('./app.module');

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(getDataSourceToken())
      .useValue(dataSource)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app?.close();
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('serves a cursor-paginated history page at /api/workout-history (200, keyset order)', async () => {
    const response = await fetch(
      `${baseUrl}/api/workout-history?userId=${SEED_USER_ID}&unit=kg&limit=1`,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.limit).toBe(1);
    expect(body.items).toHaveLength(1);
    // Newest first (performed_at DESC): entry 2 (2026-10-02).
    expect(body.items[0].entryId).toBe(SEED_ENTRY_2_ID);
    expect(body.items[0].exerciseName).toBe('Bench Press');
    expect(body.items[0].sets[0].weight).toBe(120);
    expect(typeof body.nextCursor).toBe('string');
  });

  it('follows nextCursor to the second page (no overlap)', async () => {
    const first = await (
      await fetch(`${baseUrl}/api/workout-history?userId=${SEED_USER_ID}&unit=kg&limit=1`)
    ).json();

    const second = await fetch(
      `${baseUrl}/api/workout-history?userId=${SEED_USER_ID}&unit=kg&limit=1&cursor=${encodeURIComponent(
        first.nextCursor,
      )}`,
    );

    expect(second.status).toBe(200);
    const body = await second.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].entryId).toBe(SEED_ENTRY_1_ID);
    expect(body.nextCursor).toBeNull();
  });

  it('converts weights to the requested unit (lb)', async () => {
    const response = await fetch(
      `${baseUrl}/api/workout-history?userId=${SEED_USER_ID}&unit=lb&limit=1`,
    );

    const body = await response.json();
    // 120 kg -> ~264.55 lb; original retained.
    expect(body.items[0].unit).toBe('lb');
    expect(body.items[0].sets[0].weight).toBeCloseTo(264.55, 1);
    expect(body.items[0].sets[0].originalWeight).toBe(120);
    expect(body.items[0].sets[0].originalUnit).toBe('kg');
  });

  it('returns 400 when the required `unit` is omitted', async () => {
    const response = await fetch(`${baseUrl}/api/workout-history?userId=${SEED_USER_ID}`);

    expect(response.status).toBe(400);
  });

  it('returns 400 for a malformed cursor', async () => {
    const response = await fetch(
      `${baseUrl}/api/workout-history?userId=${SEED_USER_ID}&unit=kg&cursor=not-a-valid-cursor`,
    );

    expect(response.status).toBe(400);
  });

  it('returns 404 USER_NOT_FOUND for an unknown user', async () => {
    const response = await fetch(
      `${baseUrl}/api/workout-history?userId=${UNKNOWN_USER_ID}&unit=kg`,
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.code).toBe('USER_NOT_FOUND');
  });

  it('does NOT mount the double-prefixed path /api/api/workout-history', async () => {
    const response = await fetch(
      `${baseUrl}/api/api/workout-history?userId=${SEED_USER_ID}&unit=kg`,
    );

    expect(response.status).toBe(404);
  });
});

/**
 * Personal records (F7) boots its own app over a seeded in-memory DataSource (a user + an exercise
 * with two sets + a second exercise with no sets), proving the real module graph composes the
 * controller → PR-query orchestration → core user/exercise/scale-unit/workout services, that the route
 * is mounted at /api/personal-record, that the three metrics aggregate correctly with their
 * achievement dates, and that the required-unit / unknown-user / unknown-exercise / empty-not-error
 * rules hold end to end.
 */
describe('AppModule (bootstrap smoke) — personal records (F7)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE__HOST = 'localhost';
    process.env.DATABASE__USERNAME = 'test';
    process.env.DATABASE__PASSWORD = 'test';
    process.env.DATABASE__NAME = 'test';
    process.env.API_DOCUMENT__ENABLED = 'false';

    dataSource = await createInMemoryDataSource({ seedPersonalRecords: true });

    const { AppModule } = await import('./app.module');

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(getDataSourceToken())
      .useValue(dataSource)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app?.close();
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('serves the three personal records at /api/personal-record (200, correct winners + dates)', async () => {
    const response = await fetch(
      `${baseUrl}/api/personal-record?userId=${SEED_USER_ID}&exerciseId=${SEED_EXERCISE_ID}&unit=kg`,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.unit).toBe('kg');
    // Heaviest set: 130 kg on 2026-10-01.
    expect(body.maxWeight.weight).toBe(130);
    expect(body.maxWeight.achievedAt).toContain('2026-10-01');
    // Highest volume: 12 × 90 = 1080 on 2026-10-02.
    expect(body.maxVolume.volume).toBe(1080);
    expect(body.maxVolume.achievedAt).toContain('2026-10-02');
    // Best Epley 1RM: 130 × (1 + 2/30) ≈ 138.67.
    expect(body.best1Rm.oneRepMax).toBeCloseTo(138.67, 1);
  });

  it('converts weight-scaled values to the requested unit (lb)', async () => {
    const response = await fetch(
      `${baseUrl}/api/personal-record?userId=${SEED_USER_ID}&exerciseId=${SEED_EXERCISE_ID}&unit=lb`,
    );

    const body = await response.json();
    expect(body.unit).toBe('lb');
    // 130 kg -> ~286.6 lb.
    expect(body.maxWeight.weight).toBeCloseTo(286.6, 1);
  });

  it('returns 200 with all-null metrics for a known exercise with no sets (empty-not-error)', async () => {
    const response = await fetch(
      `${baseUrl}/api/personal-record?userId=${SEED_USER_ID}&exerciseId=${PR_EXERCISE_NO_SETS_ID}&unit=kg`,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.maxWeight).toBeNull();
    expect(body.maxVolume).toBeNull();
    expect(body.best1Rm).toBeNull();
  });

  it('returns 400 when the required `unit` is omitted', async () => {
    const response = await fetch(
      `${baseUrl}/api/personal-record?userId=${SEED_USER_ID}&exerciseId=${SEED_EXERCISE_ID}`,
    );

    expect(response.status).toBe(400);
  });

  it('returns 404 USER_NOT_FOUND for an unknown user', async () => {
    const response = await fetch(
      `${baseUrl}/api/personal-record?userId=${UNKNOWN_USER_ID}&exerciseId=${SEED_EXERCISE_ID}&unit=kg`,
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.code).toBe('USER_NOT_FOUND');
  });

  it('returns 404 EXERCISE_NOT_FOUND for an unknown exercise', async () => {
    const response = await fetch(
      `${baseUrl}/api/personal-record?userId=${SEED_USER_ID}&exerciseId=${UNKNOWN_EXERCISE_ID}&unit=kg`,
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.code).toBe('EXERCISE_NOT_FOUND');
  });

  it('does NOT mount the double-prefixed path /api/api/personal-record', async () => {
    const response = await fetch(
      `${baseUrl}/api/api/personal-record?userId=${SEED_USER_ID}&exerciseId=${SEED_EXERCISE_ID}&unit=kg`,
    );

    expect(response.status).toBe(404);
  });
});

/**
 * PR comparison (F8) boots its own app over the seeded personal-records DataSource, with a FIXED clock
 * (via overriding CONTEXT__TIME) pinned to 2026-10-15T00:00:00Z so that, for timezone
 * Asia/Ho_Chi_Minh, the current month window [2026-09-30T17:00Z, 2026-10-31T17:00Z) contains the two
 * seeded October sets and the previous month window is empty. Proves the route is mounted at
 * /api/personal-record/comparison, the timezone-aware boundaries flow through, the required
 * timezone/unit rules hold, and unknown user/exercise map to 404.
 */
describe('AppModule (bootstrap smoke) — PR comparison (F8)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let baseUrl: string;

  const FIXED_NOW = new Date('2026-10-15T00:00:00.000Z');
  const fixedClock: ITimeContext = {
    getUtcNowAsync: () => Promise.resolve(FIXED_NOW),
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE__HOST = 'localhost';
    process.env.DATABASE__USERNAME = 'test';
    process.env.DATABASE__PASSWORD = 'test';
    process.env.DATABASE__NAME = 'test';
    process.env.API_DOCUMENT__ENABLED = 'false';

    dataSource = await createInMemoryDataSource({ seedPersonalRecords: true });

    const { AppModule } = await import('./app.module');

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(getDataSourceToken())
      .useValue(dataSource)
      .overrideProvider(TimeContextInjectionTokens.CONTEXT__TIME)
      .useValue(fixedClock)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app?.close();
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('serves the comparison at /api/personal-record/comparison (200, current month holds the seeded PRs, previous is new)', async () => {
    const response = await fetch(
      `${baseUrl}/api/personal-record/comparison?userId=${SEED_USER_ID}&exerciseId=${SEED_EXERCISE_ID}&granularity=month&timezone=Asia/Ho_Chi_Minh&unit=kg`,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.granularity).toBe('month');
    expect(body.timezone).toBe('Asia/Ho_Chi_Minh');
    // Boundaries are the local-month-in-UTC windows.
    expect(body.current.periodStart).toBe('2026-09-30T17:00:00.000Z');
    expect(body.current.periodEnd).toBe('2026-10-31T17:00:00.000Z');
    expect(body.previous.periodStart).toBe('2026-08-31T17:00:00.000Z');
    expect(body.previous.periodEnd).toBe('2026-09-30T17:00:00.000Z');
    // Current holds the seeded PRs; previous is empty → delta "new".
    expect(body.current.maxWeight.weight).toBe(130);
    expect(body.previous.maxWeight).toBeNull();
    expect(body.delta.maxWeight.direction).toBe('new');
    expect(body.delta.maxWeight.absolute).toBeNull();
    expect(body.delta.maxWeight.percent).toBeNull();
  });

  it('converts weight-scaled values to the requested unit (lb)', async () => {
    const response = await fetch(
      `${baseUrl}/api/personal-record/comparison?userId=${SEED_USER_ID}&exerciseId=${SEED_EXERCISE_ID}&granularity=month&timezone=Asia/Ho_Chi_Minh&unit=lb`,
    );

    const body = await response.json();
    expect(body.unit).toBe('lb');
    // 130 kg -> ~286.6 lb.
    expect(body.current.maxWeight.weight).toBeCloseTo(286.6, 1);
  });

  it('returns 400 when the required `unit` is omitted', async () => {
    const response = await fetch(
      `${baseUrl}/api/personal-record/comparison?userId=${SEED_USER_ID}&exerciseId=${SEED_EXERCISE_ID}&granularity=month&timezone=Asia/Ho_Chi_Minh`,
    );

    expect(response.status).toBe(400);
  });

  it('returns 400 when the required `timezone` is omitted', async () => {
    const response = await fetch(
      `${baseUrl}/api/personal-record/comparison?userId=${SEED_USER_ID}&exerciseId=${SEED_EXERCISE_ID}&granularity=month&unit=kg`,
    );

    expect(response.status).toBe(400);
  });

  it('returns 400 when the `timezone` is not a valid IANA zone', async () => {
    const response = await fetch(
      `${baseUrl}/api/personal-record/comparison?userId=${SEED_USER_ID}&exerciseId=${SEED_EXERCISE_ID}&granularity=month&timezone=Mars/Phobos&unit=kg`,
    );

    expect(response.status).toBe(400);
  });

  it('returns 400 when the `granularity` is omitted or invalid', async () => {
    const omitted = await fetch(
      `${baseUrl}/api/personal-record/comparison?userId=${SEED_USER_ID}&exerciseId=${SEED_EXERCISE_ID}&timezone=Asia/Ho_Chi_Minh&unit=kg`,
    );
    const invalid = await fetch(
      `${baseUrl}/api/personal-record/comparison?userId=${SEED_USER_ID}&exerciseId=${SEED_EXERCISE_ID}&granularity=decade&timezone=Asia/Ho_Chi_Minh&unit=kg`,
    );

    expect(omitted.status).toBe(400);
    expect(invalid.status).toBe(400);
  });

  it('returns 404 USER_NOT_FOUND for an unknown user', async () => {
    const response = await fetch(
      `${baseUrl}/api/personal-record/comparison?userId=${UNKNOWN_USER_ID}&exerciseId=${SEED_EXERCISE_ID}&granularity=month&timezone=Asia/Ho_Chi_Minh&unit=kg`,
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.code).toBe('USER_NOT_FOUND');
  });

  it('returns 404 EXERCISE_NOT_FOUND for an unknown exercise', async () => {
    const response = await fetch(
      `${baseUrl}/api/personal-record/comparison?userId=${SEED_USER_ID}&exerciseId=${UNKNOWN_EXERCISE_ID}&granularity=month&timezone=Asia/Ho_Chi_Minh&unit=kg`,
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.code).toBe('EXERCISE_NOT_FOUND');
  });

  it('does NOT mount the double-prefixed path /api/api/personal-record/comparison', async () => {
    const response = await fetch(
      `${baseUrl}/api/api/personal-record/comparison?userId=${SEED_USER_ID}&exerciseId=${SEED_EXERCISE_ID}&granularity=month&timezone=Asia/Ho_Chi_Minh&unit=kg`,
    );

    expect(response.status).toBe(404);
  });
});
