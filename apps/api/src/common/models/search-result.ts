/**
 * The wire envelope for an OFFSET/page-paginated list response: the page of `items`, the `limit`
 * and `offset` served, and the `total` count of all matching rows. Cursor (keyset) lists use the
 * sibling `ICursorSearchResult<T>` instead — see docs/guidelines/best-practices/pagination.md §II.4.
 */
export interface SearchResult<T> {
  //#region Properties
  items: T[];
  limit: number;
  offset?: number;
  total?: number;
  //#endregion
}
