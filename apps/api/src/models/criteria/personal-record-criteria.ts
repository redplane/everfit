/**
 * Criteria for the personal-record aggregation (F7/F8) over `workout_sets`, scoped to one
 * `(user_id, exercise_id)`. The optional `from`/`to` are the half-open UTC `performed_at` bounds used
 * by the period-comparison feature (F8, `[from, to)`); when both are omitted the aggregation is
 * all-time (F7). The three PR metrics are each a top-1 index scan under this scope (see
 * `architecture.md` §3).
 */
export interface PersonalRecordCriteria {
  //#region Properties
  userId: string;
  exerciseId: string;
  /** Inclusive UTC lower bound for `performed_at` (F8); omitted = all-time. */
  from?: Date;
  /** Exclusive UTC upper bound for `performed_at` (F8); omitted = all-time. */
  to?: Date;
  //#endregion
}
