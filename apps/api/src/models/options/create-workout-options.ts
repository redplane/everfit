import { CreateWorkoutEntryOption } from './create-workout-entry-option';

/**
 * Input for logging a workout — one or many exercises, each with its sets (F5). Consumed by
 * `IWorkoutService.createManyAsync`, which persists the whole batch in one all-or-nothing transaction
 * (§8). All existence checks, kg normalization, and `setNumber` assignment are done by the logging
 * orchestration service before this is built, so the core service only persists.
 */
export interface CreateWorkoutOptions {
  //#region Properties
  userId: string;
  entries: CreateWorkoutEntryOption[];
  //#endregion
}
