import Joi from 'joi';
import { GetUsersQueryDto } from './get-users-query.dto';
import { offsetPagerJoiSchema } from '../../../../common/schemas/offset-pager.joi-schema';

/**
 * Validates `GET /api/users` query params. Composed from the shared offset-pager schema so the
 * pagination rules (`limit` 1..100 default 20, `offset` >= 0 default 0) never drift.
 */
export const getUsersQueryJoiSchema = offsetPagerJoiSchema as Joi.ObjectSchema<GetUsersQueryDto>;
