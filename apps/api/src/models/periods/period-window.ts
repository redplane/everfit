/**
 * A half-open period window `[start, end)` as **UTC instants** (F8). The boundaries are derived from a
 * local wall-clock start in a caller-supplied IANA timezone and converted to UTC (honoring the zone's
 * offset/DST at each instant), so they can be used directly as `performed_at` range bounds.
 */
export interface PeriodWindow {
  //#region Properties
  /** Inclusive UTC lower bound. */
  start: Date;
  /** Exclusive UTC upper bound. */
  end: Date;
  //#endregion
}
