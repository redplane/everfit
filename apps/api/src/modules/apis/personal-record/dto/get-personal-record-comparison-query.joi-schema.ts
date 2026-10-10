import Joi from 'joi';
import { GetPersonalRecordComparisonQueryDto } from './get-personal-record-comparison-query.dto';
import { PeriodGranularity } from '../../../../models/periods/period-granularity';
import { userIdJoiSchema } from '../../../../common/schemas/user-id.joi-schema';
import { weightUnitJoiSchema } from '../../../../common/schemas/weight-unit.joi-schema';
import { timezoneJoiSchema } from '../../../../common/schemas/timezone.joi-schema';

/**
 * Validates `GET /api/personal-record/comparison` query params. `userId` and `exerciseId` are required
 * UUIDs; `granularity` is a required `week`/`month`/`year`; `timezone` is a required real IANA zone;
 * `unit` is a **required** registered weight code. Any missing/invalid value fails here as a 400
 * `ValidationException` before the service runs.
 */
export const getPersonalRecordComparisonQueryJoiSchema =
  Joi.object<GetPersonalRecordComparisonQueryDto>({
    userId: userIdJoiSchema.required(),
    exerciseId: Joi.string().uuid().required(),
    granularity: Joi.string()
      .valid(...Object.values(PeriodGranularity))
      .required(),
    timezone: timezoneJoiSchema.required(),
    unit: weightUnitJoiSchema.required(),
  });
