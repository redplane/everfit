import Joi from 'joi';
import { CreateWorkoutPayloadDto } from './create-workout-payload.dto';
import { userIdJoiSchema } from '../../../../common/schemas/user-id.joi-schema';
import { weightUnitJoiSchema } from '../../../../common/schemas/weight-unit.joi-schema';

/**
 * Validates the `POST /api/workout` body (F5). Shape/type rules only — domain existence (user,
 * exercise) and duplicate rejection are enforced downstream. Composes the shared `userIdJoiSchema`
 * and `weightUnitJoiSchema` so accepted ids/units never drift. A failure here is a 400
 * `ValidationException` before the service runs: missing/non-uuid ids, empty `entries`/`sets`,
 * ≤0 reps/weight, non-integer reps, bad/unknown unit, null/non-ISO `performedAt`.
 */
const workoutSetSchema = Joi.object({
  reps: Joi.number().integer().positive().required(),
  weight: Joi.number().positive().required(),
  unit: weightUnitJoiSchema.required(),
});

const workoutEntrySchema = Joi.object({
  exerciseId: Joi.string().uuid().required(),
  performedAt: Joi.string().isoDate().required(),
  sets: Joi.array().items(workoutSetSchema).min(1).required(),
});

export const createWorkoutPayloadJoiSchema = Joi.object({
  userId: userIdJoiSchema.required(),
  entries: Joi.array().items(workoutEntrySchema).min(1).required(),
}) as Joi.ObjectSchema<CreateWorkoutPayloadDto>;
