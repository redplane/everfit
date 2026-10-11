import { GetWorkoutHistoryQueryDto } from '../../dto/get-workout-history-query.dto';
import { WorkoutHistoryItemDto } from '../../dto/workout-history-item.dto';
import { ICursorSearchResult } from '../../../../../common/models/cursor-search-result';

/**
 * Orchestration contract for workout history (F6). Validates the user exists, resolves the
 * exercise-name / muscle-group filters to an exercise-id set, decodes the keyset cursor, delegates the
 * keyset query to the core workout service, resolves exercise names and converts set weights to the
 * requested unit, and assembles the cursor-paginated `ICursorSearchResult`.
 */
export interface IWorkoutHistoryQueryService {
  //#region Methods
  /**
   * Returns a keyset page of the user's history. Unknown user → `UserByIdNotFoundException` (404);
   * malformed `cursor` → `ValidationException` (400); a known user with no matching rows → an empty
   * `ICursorSearchResult` (not an error).
   */
  searchAsync(query: GetWorkoutHistoryQueryDto): Promise<ICursorSearchResult<WorkoutHistoryItemDto>>;
  //#endregion
}
