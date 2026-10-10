import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedService } from './seed.service';
import { SeedServiceInjectionTokens } from './seed-injection-tokens';
import { WorkoutEntryEntity } from '../../../modules/cores/workout/entities/workout-entry.entity';
import { WorkoutSetEntity } from '../../../modules/cores/workout/entities/workout-set.entity';
import { ExerciseEntity } from '../../../modules/cores/exercise/entities/exercise.entity';
import { UserModule } from '../../../modules/cores/user/user.module';
import { ExerciseModule } from '../../../modules/cores/exercise/exercise.module';
import { ScaleUnitModule } from '../../../modules/cores/scale-unit/scale-unit.module';
import { TimeContextModule } from '../../../common/time-context/time-context.module';

/**
 * Provides the seed orchestration service under `SERVICE__SEED`. Imports the core master-data modules
 * (so the seed reuses `IUserService` / `IExerciseService` / `IMuscleGroupService` /
 * `IScaleUnitConversionService` and obeys the same invariants as the API), the time context, and the
 * repositories used for the batched bulk workout insert.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([WorkoutEntryEntity, WorkoutSetEntity, ExerciseEntity]),
    UserModule,
    ExerciseModule,
    ScaleUnitModule,
    TimeContextModule,
  ],
  providers: [
    {
      provide: SeedServiceInjectionTokens.SERVICE__SEED,
      useClass: SeedService,
    },
  ],
  exports: [SeedServiceInjectionTokens.SERVICE__SEED],
})
export class SeedServiceModule {}
