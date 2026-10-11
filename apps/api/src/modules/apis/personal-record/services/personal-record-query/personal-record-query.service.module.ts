import { Module } from '@nestjs/common';
import { PersonalRecordQueryService } from './personal-record-query.service';
import { PersonalRecordQueryServiceInjectionTokens } from './personal-record-query-injection-tokens';
import { UserModule } from '../../../../cores/user/user.module';
import { ExerciseModule } from '../../../../cores/exercise/exercise.module';
import { ScaleUnitModule } from '../../../../cores/scale-unit/scale-unit.module';
import { WorkoutModule } from '../../../../cores/workout/workout.module';

@Module({
  imports: [UserModule, ExerciseModule, ScaleUnitModule, WorkoutModule],
  providers: [
    {
      provide: PersonalRecordQueryServiceInjectionTokens.SERVICE__PERSONAL_RECORD_QUERY,
      useClass: PersonalRecordQueryService,
    },
  ],
  exports: [PersonalRecordQueryServiceInjectionTokens.SERVICE__PERSONAL_RECORD_QUERY],
})
export class PersonalRecordQueryServiceModule {}
