import { Module } from '@nestjs/common';
import { WorkoutServiceModule } from './services/workout/workout.service.module';

/**
 * Core module for workout data (F5). Bundles and re-exports the workout service module so downstream
 * features can inject `IWorkoutService` (token `SERVICE__WORKOUT`, used by logging F5 and later
 * history F6 / PRs F7/F8). Re-exports the per-service module rather than the token, because a module
 * can only export what it provides or a module it imports.
 */
@Module({
  imports: [WorkoutServiceModule],
  exports: [WorkoutServiceModule],
})
export class WorkoutModule {}
