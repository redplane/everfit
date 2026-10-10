import { Module } from '@nestjs/common';
import { MuscleGroupApiController } from './muscle-group-api.controller';
import { ExerciseModule } from '../../cores/exercise/exercise.module';
import { JoiServiceModule } from '../../../common/services/joi/joi.module';

/**
 * API module exposing the read-only muscle-group discovery endpoint (F3): `GET /api/muscle-groups`
 * (offset list). Delegates all logic to the core muscle-group service (exported by `ExerciseModule`
 * via the `SERVICE__MUSCLE_GROUP` token).
 */
@Module({
  imports: [ExerciseModule, JoiServiceModule],
  controllers: [MuscleGroupApiController],
})
export class MuscleGroupApiModule {}
