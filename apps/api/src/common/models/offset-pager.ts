/**
 * Offset-based pagination input: a page size (`limit`) and a start offset.
 */
export interface OffsetPager {
  //#region Properties
  limit: number;
  offset: number;
  //#endregion
}
