import { Module } from '@nestjs/common';
import { WorkoutHistoryQueryService } from './workout-history-query.service';
import { WorkoutHistoryQueryServiceInjectionTokens } from './workout-history-query-injection-tokens';
import { UserModule } from '../../../../cores/user/user.module';
import { ExerciseModule } from '../../../../cores/exercise/exercise.module';
import { ScaleUnitModule } from '../../../../cores/scale-unit/scale-unit.module';
import { WorkoutModule } from '../../../../cores/workout/workout.module';

@Module({
  imports: [UserModule, ExerciseModule, ScaleUnitModule, WorkoutModule],
  providers: [
    {
      provide: WorkoutHistoryQueryServiceInjectionTokens.SERVICE__WORKOUT_HISTORY_QUERY,
      useClass: WorkoutHistoryQueryService,
    },
  ],
  exports: [WorkoutHistoryQueryServiceInjectionTokens.SERVICE__WORKOUT_HISTORY_QUERY],
})
export class WorkoutHistoryQueryServiceModule {}
