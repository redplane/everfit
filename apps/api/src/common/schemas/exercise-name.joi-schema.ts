import Joi from 'joi';

/**
 * Reusable Joi schema for an exercise name. Trimmed, 1..200 chars (matching the `varchar(200)`
 * column). Used by the `GET /api/exercises` partial-name filter and, later, by the seed path.
 */
export const exerciseNameJoiSchema = Joi.string().trim().min(1).max(200);
