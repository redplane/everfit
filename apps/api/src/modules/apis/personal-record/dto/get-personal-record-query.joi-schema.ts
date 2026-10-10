import Joi from 'joi';
import { GetPersonalRecordQueryDto } from './get-personal-record-query.dto';
import { userIdJoiSchema } from '../../../../common/schemas/user-id.joi-schema';
import { weightUnitJoiSchema } from '../../../../common/schemas/weight-unit.joi-schema';

/**
 * Validates `GET /api/personal-record` query params. `userId` and `exerciseId` are required UUIDs;
 * `unit` is **required** (M1) and must be a registered weight code — omission or an unknown code fails
 * here as a 400 `ValidationException` before the service runs.
 */
export const getPersonalRecordQueryJoiSchema = Joi.object<GetPersonalRecordQueryDto>({
  userId: userIdJoiSchema.required(),
  exerciseId: Joi.string().uuid().required(),
  unit: weightUnitJoiSchema.required(),
});
