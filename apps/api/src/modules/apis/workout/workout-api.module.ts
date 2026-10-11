import { Module } from '@nestjs/common';
import { WorkoutApiController } from './workout-api.controller';
import { WorkoutLoggingServiceModule } from './services/workout-logging/workout-logging.service.module';
import { JoiServiceModule } from '../../../common/services/joi/joi.module';

/**
 * API module exposing workout logging (F5): `POST /api/workout` (single + bulk). The thin controller
 * validates with Joi and delegates to the logging orchestration service (`SERVICE__WORKOUT_LOGGING`),
 * which runs the domain checks, kg normalization, and the atomic write.
 */
@Module({
  imports: [WorkoutLoggingServiceModule, JoiServiceModule],
  controllers: [WorkoutApiController],
})
export class WorkoutApiModule {}
