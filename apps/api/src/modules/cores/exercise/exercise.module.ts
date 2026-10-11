import { Module } from '@nestjs/common';
import { ExerciseServiceModule } from './services/exercise/exercise.service.module';
import { MuscleGroupServiceModule } from './services/muscle-group/muscle-group.service.module';

/**
 * Core module for exercise & muscle-group master data and their configurable M:N mapping (F3).
 * Bundles the exercise and muscle-group services and re-exports their provider modules so downstream
 * features can inject `IExerciseService` (token `SERVICE__EXERCISE`, used by logging F5 and history
 * F6) and `IMuscleGroupService` (token `SERVICE__MUSCLE_GROUP`). The tokens are provided by the
 * per-service modules, so this module re-exports those modules rather than the tokens (a module can
 * only export what it provides or a module it imports).
 */
@Module({
  imports: [ExerciseServiceModule, MuscleGroupServiceModule],
  exports: [ExerciseServiceModule, MuscleGroupServiceModule],
})
export class ExerciseModule {}
