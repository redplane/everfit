import { Module } from '@nestjs/common';
import { PersonalRecordApiController } from './personal-record-api.controller';
import { PersonalRecordQueryServiceModule } from './services/personal-record-query/personal-record-query.service.module';
import { JoiServiceModule } from '../../../common/services/joi/joi.module';

/**
 * API module exposing personal records (F7): `GET /api/personal-record`. The thin controller validates
 * with Joi and delegates to the PR query orchestration service
 * (`SERVICE__PERSONAL_RECORD_QUERY`), which runs the user/exercise existence checks, the three
 * index-backed top-1 aggregations, and the kg→unit conversion.
 */
@Module({
  imports: [PersonalRecordQueryServiceModule, JoiServiceModule],
  controllers: [PersonalRecordApiController],
})
export class PersonalRecordApiModule {}
