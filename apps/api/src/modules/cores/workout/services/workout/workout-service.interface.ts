import { WorkoutEntryEntity } from '../../entities/workout-entry.entity';
import { CreateWorkoutOptions } from '../../../../../models/options/create-workout-options';

/**
 * Contract for workout data access (F5). Consumed via the `SERVICE__WORKOUT` token by the logging
 * orchestration service. History (F6) and PR (F7/F8) read methods are added to this interface in
 * their own tasks.
 */
export interface IWorkoutService {
  //#region Methods
  /**
   * Persists a whole (single or bulk) workout in **one** all-or-nothing transaction (§8): every
   * parent `workout_entries` row and its `workout_sets` children are inserted together, with the
   * denormalized `user_id`/`exercise_id`/`performed_at` copied onto each set. Any failure rolls back
   * the entire batch (nothing is written). A Postgres unique-constraint violation (`23505`) on
   * `(user_id, exercise_id, performed_at, set_number)` is translated to
   * `WorkoutSetAlreadyExistsException` (409); any other error is rethrown unchanged.
   *
   * Returns each persisted parent entry with its `sets` populated.
   */
  createManyAsync(options: CreateWorkoutOptions): Promise<WorkoutEntryEntity[]>;
  //#endregion
}
