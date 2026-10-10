# Implementation Plan — Task 9: Database CLI (reset + seed)

- **Task:** `9. Database CLI (reset and seed)` — Feature **F9**.
- **Design status:** `architecture-design.md` is **ready** (no BLOCKED flag). Dependencies (Tasks 2,
  3, 4, 5) are present on the base branch — the core `IUserService.createAsync`,
  `IExerciseService.createAsync` / `mapMuscleGroupAsync`, `IMuscleGroupService.createAsync`,
  `IScaleUnitConversionService.toBaseAsync`, and the entities are all in place (the exercise service
  interface even documents `createAsync` / `mapMuscleGroupAsync` as "used by the seed CLI (Task 9)").
- **Phase:** PLAN ONLY — no production code written yet. Awaiting approval before Phase 2.

---

## 1. Branch / PR plan (stacked)

- **Branch:** `feat/9-database-cli`, created **off `feat/8-pr-comparison`** (linear-stacking rule —
  all of Tasks 2–8 are transitively included; Tasks 2–5 are the hard deps).
- **Draft PR base:** `feat/8-pr-comparison` (stacked, so the diff shows only Task 9's changes).
- Opened with `gh pr create --draft`. Title references "Task 9 — Database CLI (reset and seed)".
  **Not** marked ready by me — left draft pending `reviewer` + (if applicable) `qa`.

---

## 2. Mechanism (per architecture-design §Mechanism)

A **Nest standalone application context** (`NestFactory.createApplicationContext(CliModule)`) that
dispatches on a command argument: `reset` | `seed` | `reset-seed`. It reuses the same
`ConfigModule` + `TypeOrmModule.forRootAsync` wiring as `AppModule` (so it reads `DATABASE__*` from
`.env.api` / `.env.api.local` exactly like the app) and imports the core modules, then resolves
`ISeedService` from the container, runs the operation, closes the context, and exits with a proper
code. No HTTP server is created (it is `createApplicationContext`, not `create`), so no route and no
AppModule smoke test is required for this task.

Invoked via an **Nx `run-commands` target** (`pnpm nx run api:db-cli -- <command>`) that runs the
TS entry with **ts-node** (already a devDependency; mirrors the existing `typeorm-ts-node-commonjs`
migration scripts), plus convenience `package.json` scripts. No bundling/webpack change — the CLI is
a developer tool run from source.

---

## 3. Files to create

All under `apps/api/src/cli/` (one declaration per file; `kebab-case` folders; plural collection
folders `models`, `services`):

| Path | Purpose |
| ---- | ------- |
| `apps/api/src/cli/database-cli.ts` | Bootstrap: build the standalone context, resolve `ISeedService`, dispatch the command, close + `process.exit`. Logs row counts and elapsed time. |
| `apps/api/src/cli/cli-command.ts` | `CliCommand` enum (`RESET='reset'`, `SEED='seed'`, `RESET_SEED='reset-seed'`) — the accepted commands. |
| `apps/api/src/cli/cli-args.ts` | **Pure** arg parser/dispatcher: `parseCliArgs(argv: string[]): CliInvocation` → `{ command, count, batchSize, userId? }`; throws `InvalidCliArgumentException` for an unknown/missing command. Kept pure so every branch is unit-testable without a DB. |
| `apps/api/src/cli/exceptions/invalid-cli-argument.exception.ts` | `InvalidCliArgumentException extends Error` — thrown for an unknown command / bad `--count`. |
| `apps/api/src/cli/models/cli-invocation.ts` | `CliInvocation` interface (parsed command + options). |
| `apps/api/src/cli/models/seed-workouts-options.ts` | `SeedWorkoutsOptions` — `{ userId: string; count: number; batchSize: number }`. |
| `apps/api/src/cli/models/seed-master-data-result.ts` | `SeedMasterDataResult` — `{ userIds: string[]; exerciseIds: string[]; muscleGroupIds: string[]; mappingCount: number; demoUserId: string }`. |
| `apps/api/src/cli/cli.module.ts` | `CliModule` — imports `ConfigModule` (same `forRoot` as AppModule), `TypeOrmModule.forRootAsync`, `TimeContextModule`, the core `UserModule`, `ExerciseModule`, `ScaleUnitModule`, `WorkoutModule`, and `SeedServiceModule`. No controllers. |
| `apps/api/src/cli/services/seed/seed-service.interface.ts` | `ISeedService`: `resetAsync(): Promise<void>`; `seedMasterDataAsync(): Promise<SeedMasterDataResult>`; `seedWorkoutsAsync(options: SeedWorkoutsOptions): Promise<void>`. |
| `apps/api/src/cli/services/seed/seed.service.ts` | `SeedService implements ISeedService` — the orchestrator (reset + master data + batched bulk workouts). Injects the core service tokens, `IScaleUnitConversionService`, `ITimeContext`, and `@InjectDataSource()` for the bulk path. |
| `apps/api/src/cli/services/seed/seed-injection-tokens.ts` | `SeedServiceInjectionTokens { SERVICE__SEED = 'SERVICE__SEED' }`. |
| `apps/api/src/cli/services/seed/seed.service.module.ts` | `SeedServiceModule` — provides `SeedService` via `SERVICE__SEED`, exports the token; imports the core service modules it depends on. |
| `apps/api/src/cli/services/seed/seed.service.spec.ts` | Unit tests (pg-mem) — see §7. |
| `apps/api/src/cli/cli-args.spec.ts` | Unit tests for `parseCliArgs` — every branch incl. the throw. |

## 4. Files to change

| Path | Change |
| ---- | ------ |
| `apps/api/project.json` | Add a `db-cli` target (`nx:run-commands`) running `ts-node -P apps/api/tsconfig.app.json apps/api/src/cli/database-cli.ts`, forwarding args. Not cacheable (side-effecting). |
| `package.json` | Add convenience scripts: `"db:reset"`, `"db:seed"`, `"db:reset-seed"` wrapping `pnpm nx run api:db-cli -- <command>`. |
| `README.md` | New **"Database CLI (reset & seed)"** section under the DB docs: what each command does, how to run it (`pnpm nx run api:db-cli -- reset-seed`, the `--count` / `--user` flags, the `--yes` reset guard), the ~50k volume note and rough timing, and the **re-run-after-reset** idempotency note. |

No `app.module.ts` change (the CLI has its own module). No entity/migration change.

---

## 5. Reset strategy

`resetAsync()` clears **data only**, never schema or the `migrations` bookkeeping table:

- Executes a single **`TRUNCATE TABLE "workout_sets", "workout_entries",
  "exercise_muscle_groups", "exercises", "muscle_groups", "users" RESTART IDENTITY CASCADE`** via
  `dataSource.query(...)` — fast, FK-safe (CASCADE), and leaves the schema + `migrations` table
  intact (migrations own DDL; the CLI only clears rows). All ids are UUIDs so `RESTART IDENTITY` is
  a harmless no-op.
- **pg-mem caveat (for the unit test):** pg-mem's `TRUNCATE ... CASCADE` support is limited. The
  implementation will therefore do the clear as a **child-first `DELETE` sweep inside a single
  transaction** (order: `workout_sets` → `workout_entries` → `exercise_muscle_groups` →
  `exercises` → `muscle_groups` → `users`) via the repositories, which is portable across pg-mem
  **and** Postgres and is fully unit-testable. (Child-first order satisfies FK constraints without
  needing CASCADE.) A short comment documents that on real Postgres this is equivalent to the
  `TRUNCATE` above; the DELETE form is chosen so the behaviour is identical in the in-memory test
  and the live DB. Reset volume is not a performance concern.
- **Decision to confirm (see §9):** whether `reset` / the destructive half of `reset-seed` requires
  a `--yes` confirmation flag (default: required, to avoid accidental data loss).

## 6. Seed strategy

### 6.1 Master data (reuses the core services — same invariants as the API)

- **Users:** create a small set (e.g. 3) via `IUserService.createAsync`; one is the designated
  **demo user** (returned in `SeedMasterDataResult.demoUserId`) that receives the 50k workouts.
- **Muscle groups:** a fixed catalogue (e.g. Chest, Back, Legs, Shoulders, Arms, Core) via
  `IMuscleGroupService.createAsync`.
- **Exercises:** a fixed catalogue (e.g. Bench Press, Squat, Deadlift, Overhead Press, Barbell Row,
  …) via `IExerciseService.createAsync`.
- **M:N mapping:** map each exercise to its muscle group(s) via
  `IExerciseService.mapMuscleGroupAsync`, from a declared mapping table. Pairs are **unique by
  construction** (no pair declared twice) so `ExerciseMuscleGroupAlreadyExistsException` is never
  provoked in a clean run; the unit test asserts a duplicate pair is rejected (the guard works).

### 6.2 Large workout dataset (batched bulk insert — the performance path)

`seedWorkoutsAsync({ userId, count, batchSize })` generates **`count` (default 50,000)
`workout_entries`** for the demo user, each with a small number of sets (e.g. 1–5), and bulk-inserts
them. It does **not** go through `IWorkoutService.createManyAsync` (that saves row-by-row per call);
instead it builds plain row arrays and uses **chunked `repository.insert(chunk)`** (multi-row
`INSERT`) inside one transaction per chunk, so 50k entries + their sets are written in
`ceil(total / batchSize)` round-trips, not 50k+.

Respecting every model rule:

- **Row-per-set:** one `workout_sets` row per generated set, carrying the denormalized `user_id`,
  `exercise_id`, `performed_at` copied from its parent entry (same values, same batch) — exactly as
  the write path does.
- **UTC `performed_at` (via the time context):** anchor = `ITimeContext.getUtcNowAsync()`; entry *i*
  gets `anchor − i * step` (a fixed decreasing step, e.g. ~1 hour), spreading the data across
  **months/years** so Task 6 date ranges and Task 8 week/month/year period comparisons have data.
  Because `performed_at` strictly decreases per entry, it is **unique per entry**.
- **Normalized `weight_kg` (via `IScaleUnitConversionService`):** `unit` alternates `'kg'`/`'lb'`
  from the registry; `weight_kg = await toBaseAsync(weight, unit)` — identical normalization to the
  API, exercising both the kg (factor 1) and lb (factor 0.45359237) paths.
- **Unique `(user_id, exercise_id, performed_at, set_number)`:** `set_number` is 1-based within each
  entry, and each entry has a **unique `performed_at`**, so the 4-tuple is unique by construction —
  no constraint violation during a clean seed.
- **Ids:** UUID v7 (`uuid` `v7`) for entries and sets, matching the write path (time-ordered).
- **`created_time`:** the single `anchor` "now" from the time context.

### 6.3 Idempotency

`seed` is designed to run **after `reset`** (or use the combined `reset-seed`). Re-running `seed`
alone without a reset will collide on `uq_exercises_name` / `uq_muscle_groups_name` (and the
deterministic `performed_at`s) — this is **documented** in the README as "reset first", matching the
architecture-design decision. `reset-seed` is the recommended one-shot for the demo.

### 6.4 Configurability

- `--count <n>` (default **50000**, enforced `>= 1`; the demo target is "50,000+"),
- `--batch-size <n>` (default e.g. **2000**),
- `--user <uuid>` (optional; default = the demo user created by `seedMasterDataAsync`).

Defaults live as named constants in `cli-args.ts` / `seed.service.ts`. **No new environment
variables** are introduced (see §8).

---

## 7. Test cases

`apps/api/src/cli/cli-args.spec.ts` — pure, no DB:

- `describe('parseCliArgs')`
  - returns `RESET` for `['reset']`.
  - returns `SEED` for `['seed']`.
  - returns `RESET_SEED` for `['reset-seed']`.
  - parses `--count` / `--batch-size` / `--user` overrides.
  - applies defaults when flags are omitted.
  - **throws `InvalidCliArgumentException`** for an unknown command (exact type).
  - **throws `InvalidCliArgumentException`** for a missing command (empty argv) and for a
    non-numeric / `< 1` `--count` (each throw branch covered).

`apps/api/src/cli/services/seed/seed.service.spec.ts` — pg-mem in-memory DB (DDL mirrors the six
tables incl. the `uq_*` unique constraints; raw DDL per the existing `workout.service.spec.ts`
pattern; computed PR indexes omitted as pg-mem cannot parse them):

- `describe('resetAsync')`
  - after seeding rows in all tables, reset leaves **every table at count 0**.
  - reset on an already-empty DB is a no-op (does not throw) — covers the empty branch.
- `describe('seedMasterDataAsync')`
  - creates the expected users / exercises / muscle groups (asserts counts) and the M:N mappings
    (asserts `exercise_muscle_groups` count and that each pair is unique);
  - returns a `demoUserId` present in `users`;
  - a duplicate `mapMuscleGroupAsync` pair throws `ExerciseMuscleGroupAlreadyExistsException`
    (guard verified; exact type).
- `describe('seedWorkoutsAsync')` (small `count`, e.g. 50; small `batchSize`, e.g. 10, to force
  **multiple chunks + a remainder chunk** — covers the chunk-loop boundary branches)
  - produces **row-per-set** rows: `workout_sets` count equals the sum of generated sets;
    `workout_entries` count equals `count`;
  - `weight_kg` is correctly normalized for **both** a `kg` row (equals `weight`) and a `lb` row
    (equals `weight * 0.45359237`) — both conversion branches;
  - every `performed_at` is a UTC `Date` and **distinct across entries**;
  - `set_number` is distinct within each entry (1-based);
  - completes with **no unique-constraint violation**;
  - `count` not a multiple of `batchSize` still inserts the exact total (remainder-chunk branch).

Any extracted pure helper (chunking, round-robin exercise pick, `performed_at` generator) gets
direct branch tests. Target **≥ 80% branch coverage** on the testable logic.

**Integration-only (not unit-tested), verified via the live run (§8):** the real 50,000+ insert
(volume/timing) and the `database-cli.ts` bootstrap + `CliModule` wiring (a standalone context needs
a real DB). These are noted in the spec and PR body rather than forced into a 50k unit test.

**Existing tests touched:** **none.**

---

## 8. Verification (live `everfit-postgres`)

1. Ensure migrations are applied (`pnpm migration:run`).
2. `pnpm nx run api:db-cli -- reset-seed` against the live DB.
3. Confirm row counts: `users`/`exercises`/`muscle_groups`/`exercise_muscle_groups` populated;
   `workout_entries` **≥ 50,000**; `workout_sets` ≥ that. Record the elapsed time (the CLI logs it)
   and note it in the PR.
4. Spot-check performance on the seeded data: run a `GET /api/personal-record` and a
   `GET /api/workout-history` (and a `GET /api/personal-record/comparison`) for the demo user and
   confirm they return promptly (index-backed), demonstrating query/aggregation at scale.
5. `pnpm nx test api` (green, coverage), `pnpm nx build api` (compiles), `pnpm nx lint api` (clean).

---

## 9. Database / diagram impact

**None.** No schema change — the CLI only writes/clears **data** in the existing tables. No
migration is added and **`docs/designs/database-diagram.txt` is not edited** (it already reflects
the current schema).

## 10. Environment variables

**None added.** The CLI reuses the existing `DATABASE__*` (and `NODE_ENV`) config from `.env.api` /
`.env.api.local` via the same `ConfigModule`/data-source wiring. Dataset size / target user are CLI
flags, not env vars, so `README.md` and `.env.api.example` need **no new variable entries** (the
README does get a new usage section for the CLI, but no env changes).

---

## 11. Decisions to confirm before implementing

1. **Default dataset size** = **50,000** entries (meets "50,000+"); `--count` overridable. OK?
2. **Reset safety gate:** require a `--yes` (or `--force`) flag for `reset` / `reset-seed` so the
   destructive op can't run by accident. Proposed: **required**. OK?
3. **Commands exposed:** `reset`, `seed`, `reset-seed` via `pnpm nx run api:db-cli -- <cmd>` **and**
   `pnpm db:reset` / `db:seed` / `db:reset-seed` scripts. OK?
4. **Demo user:** `seedMasterDataAsync` creates and returns a demo user that receives the 50k
   workouts; `--user <uuid>` can target a different existing user. OK?
```
