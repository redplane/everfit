import { WorkoutEntryEntity } from '../../../../cores/workout/entities/workout-entry.entity';
import { CreateWorkoutPayloadDto } from '../../dto/create-workout-payload.dto';

/**
 * Orchestration contract for logging a workout (F5). Runs the domain checks and normalization that
 * sit between the thin controller and the core `IWorkoutService` data access, then persists the whole
 * (single or bulk) request atomically. Consumed via the `SERVICE__WORKOUT_LOGGING` token.
 */
export interface IWorkoutLoggingService {
  //#region Methods
  /**
   * Validates that the user exists (`UserByIdNotFoundException`) and every referenced exercise exists
   * (`ExerciseByIdNotFoundException`), normalizes each set's weight to kg via
   * `IScaleUnitConversionService.toBaseAsync`, assigns a 1-based `setNumber` per entry, and persists
   * the batch in one all-or-nothing transaction via `IWorkoutService.createManyAsync`. A duplicate
   * set surfaces as `WorkoutSetAlreadyExistsException` (409). Returns the persisted entries.
   */
  logAsync(payload: CreateWorkoutPayloadDto): Promise<WorkoutEntryEntity[]>;
  //#endregion
}
