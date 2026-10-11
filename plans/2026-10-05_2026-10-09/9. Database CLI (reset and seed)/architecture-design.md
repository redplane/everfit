# Architecture Design — Task 9: Database CLI (reset + seed)

- **Task:** `9. Database CLI (reset and seed)` — Feature **F9**.
- **Depends on:** Task 2 (user), Task 3 (exercise/muscle-group), Task 4 (unit), Task 5 (workout
  data). Independent of Tasks 6, 7, 8.
- **Goal:** A developer CLI with `reset` (clean state) and `seed` (master data + 50,000+ workout
  entries for a user) operations, respecting all model rules, for the performance demo.

See `architecture.md` §4 (CLI), §2, §8.

## Database changes

- **None** (no schema change). The CLI operates on the existing tables:
  - `reset`: truncate `workout_sets`, `workout_entries`, `exercise_muscle_groups`, `exercises`,
    `muscle_groups`, `users` (child-first / `TRUNCATE ... RESTART IDENTITY CASCADE`) to a clean state.
    Does **not** drop migrations' schema (migrations own DDL; the CLI only clears data).
  - `seed`: insert users, exercises, muscle groups + their M:N mapping (unique pairs), then **50,000+
    `workout_entries`** (with their sets) for a designated demo user.

## API changes

- **None** — this is a developer tool, not an HTTP endpoint.

## Mechanism

- A **Nest standalone application** entry (`NestFactory.createApplicationContext`) at
  `src/cli/database-cli.ts`, dispatching on an argument: `reset` | `seed` | `reset-seed`.
- Exposed via an **Nx target** (e.g. `pnpm nx run api:db-cli -- seed`) and documented in the README.
- Reuses the core services (`IUserService.createAsync`, `IExerciseService.createAsync` /
  `mapMuscleGroupAsync`, `IMuscleGroupService.createAsync`, `IWorkoutService.createManyAsync`) and
  the `IScaleUnitConversionService` so seed data obeys the same invariants as the API. A dedicated
  `ISeedService` orchestrates and uses **batched bulk inserts** for the 50k+ sets (chunked
  `repository.insert` / `QueryBuilder` batches, not 50k individual transactions).

## Data rules the seed must respect

- Row-per-set; UTC `performed_at` (spread across months/years so Task 8 period comparisons and Task 6
  date ranges have data); `unit` from the kg/lb registry with correct `weight_kg` normalization;
  distinct `set_number` per entry so the unique constraint is satisfied; valid M:N mappings (unique
  pairs). **Idempotency:** `seed` runs after `reset` (or `reset-seed`); re-running `seed` alone must
  not violate unique constraints — generate deterministic-but-unique `performed_at`/`set_number`
  combinations, or require a reset first (documented).

## Environment variables

- **No new variables.** Reuses the `DATABASE__*` config from Task 1 (the CLI builds the same
  `ConfigModule`/data source). Optional, non-required tuning knobs may be added later; not required
  this sprint.

## Contract

- `src/cli/database-cli.ts` (bootstrap + arg dispatch).
- `src/cli/services/seed/seed-service.interface.ts` → `ISeedService`:
  `resetAsync(): Promise<void>`, `seedMasterDataAsync(): Promise<SeedMasterDataResult>`,
  `seedWorkoutsAsync(options: SeedWorkoutsOptions): Promise<void>` (count ≥ 50_000, batch size).
  Implementation `seed.service.ts`, token `SERVICE__SEED`, `seed.service.module.ts`.
- `src/cli/cli.module.ts` importing `ConfigModule`, `TypeOrmModule`, and the core modules
  (`UserModule`, `ExerciseModule`, `ScaleUnitModule`, `WorkoutModule`), providing `SeedService`.
- `SeedWorkoutsOptions` / `SeedMasterDataResult` under `src/cli/models/`.

## Tests to define (in-memory DB)

- `src/cli/services/seed/seed.service.spec.ts`:
  - `describe('resetAsync')` — truncates all tables (row counts → 0).
  - `describe('seedMasterDataAsync')` — creates users/exercises/muscle-groups + unique M:N mappings;
    a duplicate mapping is not created twice.
  - `describe('seedWorkoutsAsync')` — a small count (e.g. 50) produces row-per-set rows with correct
    `weight_kg` normalization, UTC `performed_at`, distinct `set_number`, and no unique-constraint
    violation; batching path exercised.
  (50k is a runtime/perf concern, not a unit test; the unit test uses a small count and asserts the
  invariants, with a note that volume is validated manually via the perf demo.)

## Existing tests that must change

- **None.** → **ready**.

## Files to create/change

`src/cli/` tree (bootstrap, `cli.module.ts`, seed service folder, models). Change: add the Nx target
in `apps/api/project.json`; document usage in the README. No `app.module.ts` change (CLI has its own
module).

## Done when

`pnpm nx test api` passes (seed invariant branches); `pnpm nx build api` succeeds; `reset` clears to a
clean state; `seed` loads master data + 50,000+ entries via batched inserts in reasonable time
respecting all model rules; re-run safety documented; conventions met.
