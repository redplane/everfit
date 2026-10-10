import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExerciseService } from './exercise.service';
import { ExerciseServiceInjectionTokens } from './exercise-injection-tokens';
import { ExerciseEntity } from '../../entities/exercise.entity';
import { ExerciseMuscleGroupEntity } from '../../entities/exercise-muscle-group.entity';
import { MuscleGroupEntity } from '../../entities/muscle-group.entity';
import { TimeContextModule } from '../../../../../common/time-context/time-context.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExerciseEntity, MuscleGroupEntity, ExerciseMuscleGroupEntity]),
    TimeContextModule,
  ],
  providers: [
    {
      provide: ExerciseServiceInjectionTokens.SERVICE__EXERCISE,
      useClass: ExerciseService,
    },
  ],
  exports: [ExerciseServiceInjectionTokens.SERVICE__EXERCISE],
})
export class ExerciseServiceModule {}
