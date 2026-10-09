import { registerAs } from '@nestjs/config';

/**
 * Namespaced API-documentation configuration. `enabled` gates the OpenAPI document and the
 * Scalar UI; it defaults to `false` so docs are off unless `API_DOCUMENT__ENABLED=true`.
 */
export const apiDocumentConfig = registerAs('apiDocument', () => ({
  enabled: process.env.API_DOCUMENT__ENABLED === 'true',
}));
