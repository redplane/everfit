/**
 * The wire envelope for an OFFSET/page-paginated list response: the page of `items` plus the
 * server-computed `total` count of all matching rows. The request-echo `limit`/`offset` are
 * deliberately NOT returned — the client already chose and holds them (see
 * docs/guidelines/best-practices/pagination.md §II.1). Cursor (keyset) lists use the sibling
 * `ICursorSearchResult<T>` instead — see §II.4.
 */
export interface SearchResult<T> {
  //#region Properties
  items: T[];
  total?: number;
  //#endregion
}
