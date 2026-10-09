import { registerAs } from '@nestjs/config';

/**
 * Namespaced database configuration, sourced from the `DATABASE__*` environment variables.
 * Values are validated at boot by `envValidationJoiSchema`, so the fallbacks here only cover
 * the optional `DATABASE__PORT`.
 */
export const databaseConfig = registerAs('database', () => ({
  host: process.env.DATABASE__HOST,
  port: parseInt(process.env.DATABASE__PORT ?? '5432', 10),
  username: process.env.DATABASE__USERNAME,
  password: process.env.DATABASE__PASSWORD,
  name: process.env.DATABASE__NAME,
}));
