/**
 * Offset-pagination criteria for listing users (read-only discovery, F2). The service applies a
 * stable ordering (`name ASC, id ASC`) so pages are deterministic.
 */
export interface UserSearchCriteria {
  //#region Properties
  limit: number;
  offset: number;
  //#endregion
}
