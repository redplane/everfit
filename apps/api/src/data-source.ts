import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';

/**
 * TypeORM CLI data source used to generate, run, and revert migrations. It is deliberately
 * independent of the Nest DI container (the CLI runs outside the app), so it reads configuration
 * straight from the environment. `synchronize` stays off — schema changes go through migrations.
 *
 * Layered env loading mirrors `ConfigModule` (`.env.api` then `.env.api.local` for overrides).
 */
loadEnv({ path: ['.env.api.local', '.env.api'] });

export const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE__HOST,
  port: parseInt(process.env.DATABASE__PORT ?? '5432', 10),
  username: process.env.DATABASE__USERNAME,
  password: process.env.DATABASE__PASSWORD,
  database: process.env.DATABASE__NAME,
  synchronize: false,
  entities: ['apps/api/src/**/*.entity.ts'],
  migrations: ['apps/api/src/migrations/*.ts'],
});
