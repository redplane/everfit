/**
 * A keyset (cursor) page returned by a data-access service. Distinct from the wire
 * `ICursorSearchResult<T>`: this is the internal shape a core read returns — the page's `items` plus
 * `hasMore`, a flag derived from fetching `limit + 1` rows. The orchestration service turns `hasMore`
 * into an `ICursorSearchResult<T>` on the wire, computing its `nextCursor` (encoding the last item's
 * keyset position) and mapping items to their DTOs.
 */
export interface CursorPage<T> {
  //#region Properties
  items: T[];
  hasMore: boolean;
  //#endregion
}
