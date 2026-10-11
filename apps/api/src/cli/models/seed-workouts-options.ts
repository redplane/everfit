/**
 * Input for `ISeedService.seedWorkoutsAsync` — how many workout entries to generate for which user,
 * and the bulk-insert chunk size. Built by the CLI bootstrap from the parsed invocation.
 */
export interface SeedWorkoutsOptions {
  //#region Properties
  /** The user that receives the generated workouts. */
  userId: string;

  /** Number of parent `workout_entries` to generate (≥ 1; the demo target is 50,000+). */
  count: number;

  /** Number of rows per bulk `INSERT` chunk (≥ 1). */
  batchSize: number;
  //#endregion
}
