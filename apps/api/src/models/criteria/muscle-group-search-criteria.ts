/**
 * Offset-pagination criteria for listing muscle groups (read-only discovery, F3). The service
 * applies a stable ordering (`name ASC, id ASC`) so pages are deterministic.
 */
export interface MuscleGroupSearchCriteria {
  //#region Properties
  limit: number;
  offset: number;
  //#endregion
}
