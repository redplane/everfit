import Joi from 'joi';
import { GetWorkoutHistoryQueryDto } from './get-workout-history-query.dto';
import { cursorPagerJoiSchema } from '../../../../common/schemas/cursor-pager.joi-schema';
import { userIdJoiSchema } from '../../../../common/schemas/user-id.joi-schema';
import { weightUnitJoiSchema } from '../../../../common/schemas/weight-unit.joi-schema';
import { exerciseNameJoiSchema } from '../../../../common/schemas/exercise-name.joi-schema';

/**
 * Validates `GET /api/workout-history` query params. Extends the shared cursor-pager schema (so the
 * `limit` + opaque `cursor` rules never drift) with the required `userId` and output `unit`, plus the
 * optional filters. `unit` is **required** (M1): omission or an unknown code fails here as a 400
 * `ValidationException` before the service runs. `to` must be ≥ `from` (cross-field; Joi skips the
 * comparison when `from` is absent). The `cursor`'s structural validity is checked at decode time
 * (surfaced as INVALID_CURSOR → 400), not here.
 */
export const getWorkoutHistoryQueryJoiSchema = (cursorPagerJoiSchema as Joi.ObjectSchema).keys({
  userId: userIdJoiSchema.required(),
  unit: weightUnitJoiSchema.required(),
  exerciseName: exerciseNameJoiSchema.optional(),
  muscleGroupId: Joi.string().uuid().optional(),
  from: Joi.date().iso().optional(),
  to: Joi.date().iso().min(Joi.ref('from')).optional(),
}) as Joi.ObjectSchema<GetWorkoutHistoryQueryDto>;
