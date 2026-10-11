import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkoutService } from './workout.service';
import { WorkoutServiceInjectionTokens } from './workout-injection-tokens';
import { WorkoutEntryEntity } from '../../entities/workout-entry.entity';
import { WorkoutSetEntity } from '../../entities/workout-set.entity';
import { TimeContextModule } from '../../../../../common/time-context/time-context.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkoutEntryEntity, WorkoutSetEntity]),
    TimeContextModule,
  ],
  providers: [
    {
      provide: WorkoutServiceInjectionTokens.SERVICE__WORKOUT,
      useClass: WorkoutService,
    },
  ],
  exports: [WorkoutServiceInjectionTokens.SERVICE__WORKOUT],
})
export class WorkoutServiceModule {}
