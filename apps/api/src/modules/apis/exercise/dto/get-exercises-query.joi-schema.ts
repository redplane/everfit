import Joi from 'joi';
import { GetExercisesQueryDto } from './get-exercises-query.dto';
import { offsetPagerJoiSchema } from '../../../../common/schemas/offset-pager.joi-schema';
import { exerciseNameJoiSchema } from '../../../../common/schemas/exercise-name.joi-schema';

/**
 * Validates `GET /api/exercises` query params. Extends the shared offset-pager schema (so the
 * pagination rules never drift) with two optional filters: a partial `name` (trimmed, 1..200) and a
 * `muscleGroupId` (UUID). A malformed value fails here as a 400 `ValidationException` before the
 * service runs.
 */
export const getExercisesQueryJoiSchema = (offsetPagerJoiSchema as Joi.ObjectSchema).keys({
  name: exerciseNameJoiSchema.optional(),
  muscleGroupId: Joi.string().uuid().optional(),
}) as Joi.ObjectSchema<GetExercisesQueryDto>;
