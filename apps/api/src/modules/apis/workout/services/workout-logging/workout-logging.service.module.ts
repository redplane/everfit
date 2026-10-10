import { Module } from '@nestjs/common';
import { WorkoutLoggingService } from './workout-logging.service';
import { WorkoutLoggingServiceInjectionTokens } from './workout-logging-injection-tokens';
import { UserModule } from '../../../../cores/user/user.module';
import { ExerciseModule } from '../../../../cores/exercise/exercise.module';
import { ScaleUnitModule } from '../../../../cores/scale-unit/scale-unit.module';
import { WorkoutModule } from '../../../../cores/workout/workout.module';

@Module({
  imports: [UserModule, ExerciseModule, ScaleUnitModule, WorkoutModule],
  providers: [
    {
      provide: WorkoutLoggingServiceInjectionTokens.SERVICE__WORKOUT_LOGGING,
      useClass: WorkoutLoggingService,
    },
  ],
  exports: [WorkoutLoggingServiceInjectionTokens.SERVICE__WORKOUT_LOGGING],
})
export class WorkoutLoggingServiceModule {}
