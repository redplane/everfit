import { Module } from '@nestjs/common';
import { PersonalRecordApiController } from './personal-record-api.controller';
import { PersonalRecordQueryServiceModule } from './services/personal-record-query/personal-record-query.service.module';
import { PersonalRecordComparisonServiceModule } from './services/personal-record-comparison/personal-record-comparison.service.module';
import { JoiServiceModule } from '../../../common/services/joi/joi.module';

/**
 * API module exposing personal records: `GET /api/personal-record` (F7) and
 * `GET /api/personal-record/comparison` (F8). The thin controller validates with Joi and delegates to
 * the PR query orchestration service (`SERVICE__PERSONAL_RECORD_QUERY`) — user/exercise existence
 * checks, the three index-backed top-1 aggregations, and the kg→unit conversion — and to the PR
 * comparison service (`SERVICE__PERSONAL_RECORD_COMPARISON`) — timezone-aware period windows,
 * per-window aggregation, unit conversion, and the per-metric delta.
 */
@Module({
  imports: [
    PersonalRecordQueryServiceModule,
    PersonalRecordComparisonServiceModule,
    JoiServiceModule,
  ],
  controllers: [PersonalRecordApiController],
})
export class PersonalRecordApiModule {}
