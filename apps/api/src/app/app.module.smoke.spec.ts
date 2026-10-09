import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { newDb } from 'pg-mem';
import { DataSource } from 'typeorm';
import { UserEntity } from '../modules/cores/user/entities/user.entity';

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
  `);

  const dataSource: DataSource = db.adapters.createTypeormDataSource({
    type: 'postgres',
    entities: [UserEntity],
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
});
