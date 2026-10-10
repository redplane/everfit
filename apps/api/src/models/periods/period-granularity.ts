/**
 * The named relative period granularities for the PR comparison (F8). The enum values are the wire
 * tokens (same deliberate value-is-wire pattern approved for unit codes, `architecture.md` §1), so the
 * Joi `valid(...)` list, the boundary-helper `switch`, and the request/response wire all agree on one
 * value and cannot drift.
 */
export enum PeriodGranularity {
  //#region Members
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
  //#endregion
}
