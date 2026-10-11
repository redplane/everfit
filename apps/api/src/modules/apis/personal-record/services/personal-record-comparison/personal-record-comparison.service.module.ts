import { Module } from '@nestjs/common';
import { PersonalRecordComparisonService } from './personal-record-comparison.service';
import { PersonalRecordComparisonServiceInjectionTokens } from './personal-record-comparison-injection-tokens';
import { UserModule } from '../../../../cores/user/user.module';
import { ExerciseModule } from '../../../../cores/exercise/exercise.module';
import { ScaleUnitModule } from '../../../../cores/scale-unit/scale-unit.module';
import { WorkoutModule } from '../../../../cores/workout/workout.module';
import { TimeContextModule } from '../../../../../common/time-context/time-context.module';

@Module({
  imports: [UserModule, ExerciseModule, ScaleUnitModule, WorkoutModule, TimeContextModule],
  providers: [
    {
      provide:
        PersonalRecordComparisonServiceInjectionTokens.SERVICE__PERSONAL_RECORD_COMPARISON,
      useClass: PersonalRecordComparisonService,
    },
  ],
  exports: [PersonalRecordComparisonServiceInjectionTokens.SERVICE__PERSONAL_RECORD_COMPARISON],
})
export class PersonalRecordComparisonServiceModule {}
