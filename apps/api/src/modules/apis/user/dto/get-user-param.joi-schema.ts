import Joi from 'joi';
import { GetUserParamDto } from './get-user-param.dto';
import { userIdJoiSchema } from '../../../../common/schemas/user-id.joi-schema';

/**
 * Validates the `:id` route param of `GET /api/users/:id`. A missing or malformed (non-UUID) id
 * fails here and becomes a 400 `ValidationException` before any lookup runs.
 */
export const getUserParamJoiSchema = Joi.object<GetUserParamDto>({
  id: userIdJoiSchema.required(),
});
