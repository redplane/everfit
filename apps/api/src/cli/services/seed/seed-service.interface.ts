import { SeedMasterDataResult } from '../../models/seed-master-data-result';
import { SeedWorkoutsOptions } from '../../models/seed-workouts-options';

/**
 * Contract for the database seed/reset orchestration behind the CLI (F9). Consumed by the CLI
 * bootstrap via the `SERVICE__SEED` token. Reuses the core services so seeded data obeys the same
 * invariants as the API, and uses batched bulk inserts for the large workout dataset.
 */
export interface ISeedService {
  //#region Methods
  /**
   * Clears all domain data to a clean state — data only, never the schema or the migrations table.
   * Deletes child-first in FK-safe order (`workout_sets` → `workout_entries` →
   * `exercise_muscle_groups` → `exercises` → `muscle_groups` → `users`) inside a single transaction,
   * so it leaves an empty database with every table at zero rows. Safe to run on an already-empty DB.
   */
  resetAsync(): Promise<void>;

  /**
   * Seeds master data — users, exercises, muscle groups, and their unique M:N mappings — via the core
   * services (so every record obeys the same rules as the API). Returns a summary including the demo
   * user designated to receive the large workout dataset. Expects a clean DB (run `resetAsync` first);
   * re-running against existing data violates the unique name/pair constraints.
   */
  seedMasterDataAsync(): Promise<SeedMasterDataResult>;

  /**
   * Generates and persists `options.count` workout entries (row-per-set children) for
   * `options.userId`, using chunked bulk inserts of `options.batchSize`. Each set gets a UTC
   * `performed_at` from the time context (strictly varying, so the
   * `(user_id, exercise_id, performed_at, set_number)` unique key holds), a `weight_kg` normalized via
   * `IScaleUnitConversionService`, a mix of `kg`/`lb` original units, and a 1-based `set_number`.
   */
  seedWorkoutsAsync(options: SeedWorkoutsOptions): Promise<void>;
  //#endregion
}
