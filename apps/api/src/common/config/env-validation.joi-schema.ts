import Joi from 'joi';

/**
 * Boot-time environment validation schema passed to `ConfigModule.forRoot({ validationSchema })`.
 *
 * Required variables (no default) fail startup when missing; optional variables are coerced and
 * defaulted. This is standalone Joi used by ConfigModule — distinct from the request-time
 * `JoiService`.
 */
export const envValidationJoiSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().integer().min(0).max(65535).default(3000),
  DATABASE__HOST: Joi.string().required(),
  DATABASE__PORT: Joi.number().integer().min(0).max(65535).default(5432),
  DATABASE__USERNAME: Joi.string().required(),
  DATABASE__PASSWORD: Joi.string().required(),
  DATABASE__NAME: Joi.string().required(),
  API_DOCUMENT__ENABLED: Joi.boolean().default(false),
}).unknown(true);
