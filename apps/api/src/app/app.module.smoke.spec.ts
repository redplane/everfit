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

const SEED_USER_ID = '018f6b0a-0000-7000-8000-000000000001';
const SEED_EXERCISE_ID = '018f6b0a-0000-7000-8000-0000000000a1';

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
  options: { seedWorkoutRefs?: boolean } = {},
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
    expect(body.limit).toBe(20);
    expect(body.offset).toBe(0);
    expect(body.total).toBe(0);
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
    expect(body.limit).toBe(20);
    expect(body.offset).toBe(0);
    expect(body.total).toBe(0);
  });

  it('serves the muscle-group list at /api/muscle-groups', async () => {
    const response = await fetch(`${baseUrl}/api/muscle-groups`);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.limit).toBe(20);
    expect(body.offset).toBe(0);
    expect(body.total).toBe(0);
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
