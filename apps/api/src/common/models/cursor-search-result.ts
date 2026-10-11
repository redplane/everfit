/**
 * The wire envelope for a CURSOR (keyset) paginated list response. It carries ONLY the page of
 * `items`, the `limit` it was served for, and `nextCursor` (null on the last page). It has NO
 * `total`/`offset` by construction — see docs/guidelines/best-practices/pagination.md §II.2-3.
 * Offset/page lists use the sibling `SearchResult<T>` instead.
 */
export interface ICursorSearchResult<T> {
  //#region Properties
  items: T[];
  limit: number;
  nextCursor: string | null;
  //#endregion
}
