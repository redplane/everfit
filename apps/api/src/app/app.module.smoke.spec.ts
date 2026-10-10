import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { newDb } from 'pg-mem';
import { DataSource } from 'typeorm';
import { UserEntity } from '../modules/cores/user/entities/user.entity';
import { ExerciseEntity } from '../modules/cores/exercise/entities/exercise.entity';
import { MuscleGroupEntity } from '../modules/cores/exercise/entities/muscle-group.entity';
import { ExerciseMuscleGroupEntity } from '../modules/cores/exercise/entities/exercise-muscle-group.entity';

/**
 * Bootstrap / wiring smoke test. It composes the REAL `AppModule` exactly as `main.ts` does
 * (global prefix `api`) and actually boots an HTTP listener, so it catches wiring defects that
 * provider-level unit tests cannot — e.g. an invalid module export (Nest `UnknownExportException`
 * fails `.compile()`) or a controller mounted at the wrong path.
 *
 * It stays hermetic by overriding the TypeORM DataSource with an in-memory pg-mem instance, so no
 * live Postgres is required in CI.
 */
async function createInMemoryDataSource(): Promise<DataSource> {
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
  `);

  const dataSource: DataSource = db.adapters.createTypeormDataSource({
    type: 'postgres',
    entities: [UserEntity, ExerciseEntity, MuscleGroupEntity, ExerciseMuscleGroupEntity],
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
