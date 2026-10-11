/**
 * The direction of a per-metric PR delta between the current and previous period (F8). Wire values
 * (value-is-wire pattern, `architecture.md` §1):
 * - `UP` / `DOWN` — current is higher / lower than previous (both present).
 * - `SAME` — current equals previous, or neither period has the metric.
 * - `NEW` — previous is null and current is present (null percent; no divide-by-zero).
 * - `NONE` — current is null but previous is present (a no-data marker; null absolute and percent).
 */
export enum PersonalRecordDeltaDirection {
  //#region Members
  UP = 'up',
  DOWN = 'down',
  SAME = 'same',
  NEW = 'new',
  NONE = 'none',
  //#endregion
}
