import Joi from 'joi';
import { GetMuscleGroupsQueryDto } from './get-muscle-groups-query.dto';
import { offsetPagerJoiSchema } from '../../../../common/schemas/offset-pager.joi-schema';

/**
 * Validates `GET /api/muscle-groups` query params. Composed from the shared offset-pager schema so
 * the pagination rules (`limit` 1..100 default 20, `offset` >= 0 default 0) never drift.
 */
export const getMuscleGroupsQueryJoiSchema =
  offsetPagerJoiSchema as Joi.ObjectSchema<GetMuscleGroupsQueryDto>;
