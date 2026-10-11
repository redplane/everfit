/**
 * Cursor-based (keyset) pagination input: a page size (`limit`) and an opaque `cursor`
 * that encodes the position of the last item of the previous page.
 */
export interface CursorPager {
  //#region Properties
  limit: number;
  cursor?: string;
  //#endregion
}
