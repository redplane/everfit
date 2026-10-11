/**
 * The winning set for one PR metric (F7/F8), all values in **kg** (storage canonical). The display
 * conversion to the requested unit is the orchestration service's concern (read-time only).
 * - `weightKg` / `reps` / `achievedAt` are the contributing set's weight, reps, and `performed_at`.
 * - `volumeKg` is set only for the max-volume metric (`reps * weightKg`).
 * - `oneRepMaxKg` is set only for the best-Epley-1RM metric (`weightKg * (1 + reps / 30)`).
 */
export interface PersonalRecordWinner {
  //#region Properties
  weightKg: number;
  reps: number;
  volumeKg?: number;
  oneRepMaxKg?: number;
  achievedAt: Date;
  //#endregion
}

/**
 * The three personal records for a `(user, exercise)` scope (F7/F8), each the top-1 set under its
 * metric or `null` when the user has no sets for that exercise (empty-but-not-an-error). Returned by
 * `IWorkoutService.getPersonalRecordsAsync`; derived values (`volumeKg`/`oneRepMaxKg`) are computed
 * from the winning kg row.
 */
export interface PersonalRecordAggregate {
  //#region Properties
  /** Heaviest single set — `MAX(weight_kg)`. */
  maxWeight: PersonalRecordWinner | null;
  /** Highest-volume set — `MAX(reps * weight_kg)`. */
  maxVolume: PersonalRecordWinner | null;
  /** Best estimated 1RM — `MAX(weight_kg * (1 + reps / 30))` (Epley). */
  best1Rm: PersonalRecordWinner | null;
  //#endregion
}
