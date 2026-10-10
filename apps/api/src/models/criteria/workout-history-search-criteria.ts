/**
 * Keyset (cursor) search criteria for workout history (F6). The data-access service orders by
 * `performed_at DESC, id DESC` under `user_id` (the keyset index) and fetches `limit + 1` rows to
 * detect a next page. All filters are AND-combined:
 * - `exerciseIds`: when set, only entries whose `exercise_id` is in this set (already resolved +
 *   intersected from the partial-name and/or muscle-group filters by the orchestration service). An
 *   empty set is short-circuited upstream to an empty result and never reaches the service.
 * - `from` / `to`: inclusive UTC `performed_at` range bounds.
 * - `cursor`: the decoded keyset position of the last item of the previous page; when present the
 *   service applies the expanded predicate `performed_at < p OR (performed_at = p AND id < id)`.
 */
export interface WorkoutHistorySearchCriteria {
  //#region Properties
  userId: string;
  exerciseIds?: string[];
  from?: Date;
  to?: Date;
  cursor?: { performedAt: Date; id: string };
  limit: number;
  //#endregion
}
