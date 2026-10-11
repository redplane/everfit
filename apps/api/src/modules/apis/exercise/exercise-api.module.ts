import { Module } from '@nestjs/common';
import { ExerciseApiController } from './exercise-api.controller';
import { ExerciseModule } from '../../cores/exercise/exercise.module';
import { JoiServiceModule } from '../../../common/services/joi/joi.module';

/**
 * API module exposing the read-only exercise discovery endpoint (F3): `GET /api/exercises` (offset
 * list, each exercise including its mapped muscle groups, optional partial-name / muscle-group
 * filters). Delegates all logic to the core exercise service (exported by `ExerciseModule` via the
 * `SERVICE__EXERCISE` token).
 */
@Module({
  imports: [ExerciseModule, JoiServiceModule],
  controllers: [ExerciseApiController],
})
export class ExerciseApiModule {}
