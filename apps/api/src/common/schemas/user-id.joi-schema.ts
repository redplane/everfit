import Joi from 'joi';

/**
 * Reusable Joi schema for a user id (UUID). Consumed by the user read endpoint here and by every
 * downstream read/log feature (F5–F8) so the accepted id format never drifts. Callers apply
 * `.required()` at the composition site.
 */
export const userIdJoiSchema = Joi.string().uuid();
