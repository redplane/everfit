/**
 * A generic, paginated result envelope returned by list endpoints.
 *
 * - Offset-paginated lists populate `offset` and `total`.
 * - Cursor-paginated lists populate `nextCursor` (null when the last page is reached).
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
