/**
 * A generic, paginated result envelope returned by list endpoints.
 *
 * - Offset-paginated lists populate `offset` and `total`.
 * - Cursor-paginated lists populate `nextCursor` (null when the last page is reached) and **must
 *   not** set `total` (see `docs/guidelines/best-practices/pagination.md` §II.2).
 */
export interface SearchResult<T> {
  //#region Properties
  items: T[];
  limit: number;
  offset?: number;
  total?: number;
  nextCursor?: string | null;
  //#endregion
}
