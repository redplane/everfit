import { WorkoutEntryEntity } from '../../entities/workout-entry.entity';
import { CreateWorkoutOptions } from '../../../../../models/options/create-workout-options';
import { WorkoutHistorySearchCriteria } from '../../../../../models/criteria/workout-history-search-criteria';
import { CursorPage } from '../../../../../common/models/cursor-page';

/**
 * Contract for workout data access (F5/F6). Consumed via the `SERVICE__WORKOUT` token by the logging
 * (F5) and history (F6) orchestration services. PR (F7/F8) read methods are added to this interface
 * in their own tasks.
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

  /**
   * Keyset-paginated workout history for one user (F6), ordered `performed_at DESC, id DESC` under the
   * `(user_id, performed_at DESC, id DESC)` index — stable under concurrent inserts. Fetches
   * `limit + 1` parent entries to compute `hasMore`, trims to `limit`, and attaches each entry's
   * `sets` (kg values as stored; unit conversion is the caller's concern). Applies the optional
   * `exerciseIds` / `from` / `to` / `cursor` filters (AND-combined). A known user with no matching
   * rows yields `{ items: [], hasMore: false }` — not an error.
   */
  searchHistoryAsync(
    criteria: WorkoutHistorySearchCriteria,
  ): Promise<CursorPage<WorkoutEntryEntity>>;
  //#endregion
}
