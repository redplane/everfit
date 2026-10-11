import { Module } from '@nestjs/common';
import { WorkoutHistoryApiController } from './workout-history-api.controller';
import { WorkoutHistoryQueryServiceModule } from './services/workout-history-query/workout-history-query.service.module';
import { JoiServiceModule } from '../../../common/services/joi/joi.module';

/**
 * API module exposing workout history (F6): `GET /api/workout-history` (cursor/keyset paginated). The
 * thin controller validates with Joi and delegates to the history query orchestration service
 * (`SERVICE__WORKOUT_HISTORY_QUERY`), which runs the user check, filter/cursor resolution, the keyset
 * read, and the unit conversion.
 */
@Module({
  imports: [WorkoutHistoryQueryServiceModule, JoiServiceModule],
  controllers: [WorkoutHistoryApiController],
})
export class WorkoutHistoryApiModule {}
