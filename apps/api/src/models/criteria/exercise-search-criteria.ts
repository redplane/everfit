/**
 * Offset-pagination criteria for listing exercises (read-only discovery, F3). The service applies a
 * stable ordering (`name ASC, id ASC`) so pages are deterministic, eager-loads each exercise's
 * mapped muscle groups, and narrows by the optional filters when present:
 * - `name`: partial (case-insensitive) match on the exercise name.
 * - `muscleGroupId`: only exercises mapped to that muscle group.
 */
export interface ExerciseSearchCriteria {
  //#region Properties
  limit: number;
  offset: number;
  name?: string;
  muscleGroupId?: string;
  //#endregion
}
