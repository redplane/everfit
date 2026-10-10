# Implementation Plan — Task 7: Personal records (F7)

Phase 1 (PLAN ONLY). No production code written yet. Awaiting approval before Phase 2.

Scope confirmed against `description.txt` (product), `architecture-design.md` (confirmed contract),
and `architecture.md` §2.6 / §2.7.1 / §3 / §5 / §6. The architecture-design is **confirmed** (its
"Existing tests that must change: None → ready"), so I may proceed to plan.

---

## 1. Summary of the endpoint

`GET /api/personal-record?userId=<uuid>&exerciseId=<uuid>&unit=<kg|lb>` → `200 PersonalRecordDto`.

For a (user, exercise) it returns three PRs, each a **top-1 index scan** over `workout_sets`:
- `maxWeight` = `MAX(weight_kg)`
- `maxVolume` = `MAX(reps * weight_kg)`
- `best1Rm` = `MAX(weight_kg * (1 + reps / 30.0))` (Epley, exactly `weight × (1 + reps/30)`)

Each metric carries its achievement date (`performed_at`) and the contributing set's reps/weight.
All metrics are computed on normalized **kg**; weight-scaled outputs are converted to the requested
`unit` for display only (`fromBaseAsync`, 2 dp). A known user/exercise with **no sets** → each
metric is `null` (empty-but-not-an-error). Unknown user → `404 USER_NOT_FOUND`.

**Confirmed contract decisions** (from `architecture-design.md`):
- **Exercise existence is NOT validated.** The design lists only `400` (validation) and
  `404 USER_NOT_FOUND` as errors, and states "Known user/exercise with no sets → 200 with null
  metrics." An unknown `exerciseId` therefore simply yields no matching sets → all-null metrics
  (empty-not-error), not a 404. No `ExerciseByIdNotFoundException` is thrown here. (I surface this
  explicitly so the reviewer/QA can confirm the intent; it matches the empty-not-error rule.)
- `unit` is **required**; omission or an unknown code → `400 VALIDATION_ISSUE` at the Joi boundary
  before the service runs.

---

## 2. Changes — files to create / change (exact paths)

### 2.1 Core `workout` module — extend the existing data-access contract (no new module)

- **CHANGE** `apps/api/src/modules/cores/workout/services/workout/workout-service.interface.ts`
  — add:
  ```ts
  getPersonalRecordsAsync(criteria: PersonalRecordCriteria): Promise<PersonalRecordAggregate>;
  ```
- **CHANGE** `apps/api/src/modules/cores/workout/services/workout/workout.service.ts`
  — implement `getPersonalRecordsAsync` (three top-1 query-builder reads over `WorkoutSetEntity`;
  derive `volumeKg` / `oneRepMaxKg` in TS from the winning row; see §3). No constructor change
  (the `__setRepository` is already injected).

### 2.2 New shared models (internal, not wire DTOs)

- **CREATE** `apps/api/src/models/criteria/personal-record-criteria.ts` —
  ```ts
  export interface PersonalRecordCriteria {
    userId: string;
    exerciseId: string;
    from?: Date;   // reserved for Task 8 (period-bounded); omitted = all-time
    to?: Date;
  }
  ```
- **CREATE** `apps/api/src/models/results/personal-record-aggregate.ts` (new `results/` folder) —
  ```ts
  export interface PersonalRecordWinner {
    weightKg: number;
    reps: number;
    volumeKg?: number;     // set for maxVolume
    oneRepMaxKg?: number;  // set for best1Rm
    achievedAt: Date;
  }
  export interface PersonalRecordAggregate {
    maxWeight: PersonalRecordWinner | null;
    maxVolume: PersonalRecordWinner | null;
    best1Rm: PersonalRecordWinner | null;
  }
  ```

### 2.3 New API module `personal-record/` (thin controller + orchestration service)

Folder: `apps/api/src/modules/apis/personal-record/`

- **CREATE** `personal-record-api.controller.ts` — `@ApiTags('Personal records')`,
  `@Controller({ path: 'personal-record' })` (NO `api` prefix — global prefix adds it),
  `@Get()` `getAsync(@Query() query)`: validate with Joi → delegate to the query service. Thin.
- **CREATE** `personal-record-api.module.ts` — imports `PersonalRecordQueryServiceModule`,
  `JoiServiceModule`; declares the controller.
- **CREATE** `dto/get-personal-record-query.dto.ts` — `GetPersonalRecordQueryDto`
  (`userId`, `exerciseId`, `unit`), `@ApiProperty` documented.
- **CREATE** `dto/get-personal-record-query.joi-schema.ts` —
  ```ts
  export const getPersonalRecordQueryJoiSchema = Joi.object<GetPersonalRecordQueryDto>({
    userId: userIdJoiSchema.required(),
    exerciseId: Joi.string().uuid().required(),
    unit: weightUnitJoiSchema.required(),
  });
  ```
- **CREATE** `dto/personal-record-metric.dto.ts` — `PersonalRecordMetricDto` with the union of
  fields the three metrics need, each `@ApiPropertyOptional`:
  `{ weight: number; reps: number; achievedAt: Date; volume?: number; oneRepMax?: number }`.
  (One shared metric DTO keeps "one declaration per file" while matching the design's per-metric
  shapes: `maxWeight`→`{weight,reps,achievedAt}`, `maxVolume`→`{volume,weight,reps,achievedAt}`,
  `best1Rm`→`{oneRepMax,weight,reps,achievedAt}`. Unused fields stay `undefined`. **Decision to
  confirm:** acceptable vs. three separate metric DTO classes — I prefer the single shared DTO for
  DRY; flag if three distinct classes are preferred.)
- **CREATE** `dto/personal-record.dto.ts` — `PersonalRecordDto`
  `{ userId, exerciseId, unit, maxWeight: PersonalRecordMetricDto|null, maxVolume: …|null,
  best1Rm: …|null }`.
- **CREATE** `services/personal-record-query/personal-record-query-service.interface.ts` —
  `IPersonalRecordQueryService.getAsync(query: GetPersonalRecordQueryDto): Promise<PersonalRecordDto>`.
- **CREATE** `services/personal-record-query/personal-record-query.service.ts` —
  `PersonalRecordQueryService` injecting `SERVICE__USER`, `SERVICE__SCALE_UNIT_CONVERSION`,
  `SERVICE__WORKOUT` (by token, interface-typed). Orchestrates: (4) user-exists check →
  `UserByIdNotFoundException`; (5) `getPersonalRecordsAsync`; map kg→unit via `fromBaseAsync`
  and build `PersonalRecordDto` (null metrics stay null).
- **CREATE** `services/personal-record-query/personal-record-query-injection-tokens.ts` —
  `enum { SERVICE__PERSONAL_RECORD_QUERY = 'SERVICE__PERSONAL_RECORD_QUERY' }`.
- **CREATE** `services/personal-record-query/personal-record-query.service.module.ts` —
  provides the service under its token + exports it; imports the core modules it needs
  (`UserModule`, `ScaleUnitModule`, `WorkoutModule` — whichever re-export the required tokens;
  mirror `workout-history-query.service.module.ts`).

### 2.4 Wire into the app

- **CHANGE** `apps/api/src/app/app.module.ts` — import and register `PersonalRecordApiModule` in
  `imports`.

### 2.5 Branch / PR plan (stacked)

- Branch `feat/7-personal-records` **off `feat/6-get-workout-history`** (linear stack).
- Draft PR, **base = `feat/6-get-workout-history`** (stacked so the diff shows only Task 7).
- One draft PR for the task; not marked ready (pending reviewer + QA).

---

## 3. Aggregation — exact QueryBuilder for each top-1 read

Three **separate** top-1 reads over `WorkoutSetEntity`, each driving its own expression/descending
index. Justification for 50k+: each is an `ORDER BY <metric> DESC … LIMIT 1` that the matching
index (`ix_workout_sets_user_id_exercise_id_weight_kg` / `…_volume` / `…_epley`) serves as an
O(log n) top-1 index scan (leading equality on `user_id, exercise_id`, then the sorted metric), so
the whole endpoint is 3 × O(log n) — no sequential scan, no in-memory sort. A single combined query
(e.g. three window functions / three correlated sub-selects) cannot use all three distinct ordered
indexes simultaneously and would force a scan/sort over the partition, so three index-backed
top-1s is strictly better at scale. The three reads are independent → run them with
`Promise.all`.

Each read (shown for max weight; the others swap the `ORDER BY` expression):
```ts
const row = await this.__setRepository
  .createQueryBuilder('s')
  .where('s.user_id = :userId', { userId })
  .andWhere('s.exercise_id = :exerciseId', { exerciseId })
  // (Task 8 will add optional s.performed_at >= :from / < :to here.)
  .orderBy('s.weight_kg', 'DESC')
  .addOrderBy('s.performed_at', 'ASC')   // earliest achievement wins ties (deterministic)
  .addOrderBy('s.id', 'ASC')             // final deterministic tie-break
  .limit(1)
  .getOne();
```
- **max volume** ORDER BY: `(s.reps * s.weight_kg) DESC, s.performed_at ASC, s.id ASC`.
- **best 1RM** ORDER BY: `(s.weight_kg * (1 + s.reps / 30.0)) DESC, s.performed_at ASC, s.id ASC`
  — note `30.0` (float) to match the `…_epley` index expression and avoid integer division.
- Order-by expressions are written as raw fragments via `.orderBy('<expr>', 'DESC')` so the SQL
  text matches the index expression exactly (expression indexes are only used when the ORDER BY
  expression is textually equivalent).

Derived values computed in TS from the winning row (not in SQL), per the design
("Volume/1RM are derived from the kg weight of the winning row"):
- `maxVolume.volumeKg = row.reps * row.weightKg`
- `best1Rm.oneRepMaxKg = row.weightKg * (1 + row.reps / 30)`
- `achievedAt = row.performedAt`.

`getOne()` returning `undefined`/`null` (no sets) → that metric is `null` in the aggregate.

### Output conversion (in the query service, kg → requested unit)
- `maxWeight.weight = fromBaseAsync(weightKg, unit)` (2 dp).
- `maxVolume.weight = fromBaseAsync(weightKg, unit)`; `maxVolume.volume = fromBaseAsync(volumeKg, unit)`
  — `volumeKg` is a kg-scaled quantity (reps·kg), so its weight component converts with the same
  factor; converting it directly keeps a single 2-dp rounding. **Decision to confirm:** this
  realizes the design's "convert … the volume's weight component"; flag if volume should instead be
  `reps × convertedWeight`.
- `best1Rm.weight = fromBaseAsync(weightKg, unit)`; `best1Rm.oneRepMax = fromBaseAsync(oneRepMaxKg, unit)`.
- `reps` and `achievedAt` pass through unchanged.

---

## 4. Database impact — NONE

No schema change. Confirmed the three PR expression indexes and the period index already exist in
`apps/api/src/migrations/1791610517255-CreateWorkoutTables.ts` (verified):
`ix_workout_sets_user_id_exercise_id_weight_kg`, `…_volume` (`(reps * weight_kg) DESC`),
`…_epley` (`(weight_kg * (1 + reps / 30.0)) DESC`), and
`ix_workout_sets_user_id_exercise_id_performed_at`.
No new migration, **no change to `docs/designs/database-diagram.txt`**, and **no new environment
variables** (so no README / `.env.api` change).

---

## 5. Tests to be written (new)

Unit-testing rules honored: every branch covered; thrown exceptions asserted by **exact type**;
in-memory **pg-mem** DB for persistence; one `describe` per function per file; branch coverage ≥ 80%.

> **pg-mem note.** pg-mem cannot create the computed/`DESC` expression indexes and may not plan an
> index scan, but it **can evaluate** the arithmetic in `ORDER BY (reps * weight_kg)` /
> `ORDER BY (weight_kg * (1 + reps / 30.0))`. So the core-service spec seeds rows and asserts the
> **winning row / aggregation correctness** (which row each metric selects, incl. tie-break), not
> index usage. Index usage is verified separately against live Postgres before the PR (see §6).

### 5.1 `…/cores/workout/services/workout/workout.service.spec.ts` (EXTEND — add a new `describe`)
`describe('getPersonalRecordsAsync')` (seed sets via the existing in-memory DDL + a few inserts;
add `weight_kg` rows):
- selects the **heaviest single set** (correct `weightKg`, `reps`, `achievedAt`).
- selects the **highest-volume set** (`reps * weightKg`), incl. a case where the heaviest set is
  *not* the highest-volume set (distinct winners).
- selects the **best Epley 1RM** and computes `oneRepMaxKg = weightKg*(1+reps/30)` exactly
  (e.g. 100 kg × 10 reps → 133.333…), and a case where the 1RM winner differs from max weight.
- **tie-break**: two rows with equal metric but different `performed_at` → the **earliest**
  `performed_at` wins (and equal `performed_at` → lower `id`).
- **no data** for the (user, exercise) → `{ maxWeight: null, maxVolume: null, best1Rm: null }`.
- isolates by `(user_id, exercise_id)`: rows for another user / another exercise are excluded.
- range-bounded variant (seed rows in/out of a `from`/`to` window) — asserts the optional range
  filter (lands now, exercised fully in Task 8).

### 5.2 `…/apis/personal-record/services/personal-record-query/personal-record-query.service.spec.ts`
`describe('getAsync')` with stub `IUserService` / `IScaleUnitConversionService` / `IWorkoutService`
(mirroring the history-query spec's stubs):
- **happy path**: builds `PersonalRecordDto`; weight-scaled fields converted via `fromBaseAsync`
  (assert kg→lb conversion and 2 dp); `reps`/`achievedAt` pass through.
- verifies **volume & 1RM are derived from kg then converted** (stub conversion makes the factor
  observable).
- **unknown user** → `existsByIdAsync` false → rejects with `UserByIdNotFoundException` (exact type);
  the workout service is **not** called (branch: guard returns before DB).
- **no-data** (aggregate all null) → returns a `PersonalRecordDto` with `maxWeight/maxVolume/best1Rm`
  all `null` and no throw (empty-not-error branch); conversion service not invoked for null metrics.
- each metric independently null vs present (branch coverage of the three null-guards).

### 5.3 `…/apis/personal-record/personal-record-api.controller.spec.ts`
`describe('getAsync')` with a stub query service + real `JoiService` (mirror history controller spec):
- validates and delegates; returns the `PersonalRecordDto` from the service.
- **missing `unit`** → `ValidationException` (exact type).
- **unsupported `unit`** (e.g. `'stone'`) → `ValidationException`.
- missing / non-uuid `userId` → `ValidationException`.
- missing / non-uuid `exerciseId` → `ValidationException`.
- propagates `UserByIdNotFoundException` from the service (404 path).

### 5.4 AppModule bootstrap smoke test (REQUIRED standing policy)
- **EXTEND** `apps/api/src/app/app.module.smoke.spec.ts`: add a new
  `describe('AppModule (bootstrap smoke) — personal records (F7)')` that boots the **real**
  `AppModule` over a pg-mem DataSource seeded with a user + exercise + a few sets (add a gated
  `seedPersonalRecords` option to the existing `createInMemoryDataSource` helper), then probes:
  - `GET /api/personal-record?userId=…&exerciseId=…&unit=kg` → `200`, correct `maxWeight` /
    `maxVolume` / `best1Rm` values and `achievedAt`.
  - `unit=lb` → weight-scaled values converted; `unit` echoed as `lb`.
  - omitted `unit` → `400`.
  - unknown user → `404 USER_NOT_FOUND`.
  - known user + **unknown exercise** (no sets) → `200` with all-null metrics (empty-not-error).
  - `GET /api/api/personal-record` (double prefix) → `404`.
  - **This only ADDS new cases + a gated helper option; it does not modify or delete any existing
    smoke case** (the existing F1/F5/F6 describes and their seeds are untouched). Flagged here
    because it edits an existing test file — see §7.

---

## 6. Live-Postgres verification before the PR
Besides `pnpm nx test api` (green, coverage), `pnpm nx build api`, `pnpm nx lint api`, I will boot
the app against the real `everfit-postgres` (migrations applied), seed a few sets, hit
`GET /api/personal-record`, and run `EXPLAIN` on the three top-1 queries to confirm each uses its
expression/descending index (not a seq scan) — since pg-mem cannot prove index usage.

---

## 7. Existing tests touched
- **No existing test *case* is modified or deleted.** New spec files are added (5.1 extends the core
  workout spec with a brand-new `describe`; its existing `createManyAsync`/`searchHistoryAsync`
  cases are untouched).
- `app.module.smoke.spec.ts` is **edited to add new cases + one gated helper option**
  (`seedPersonalRecords`); existing cases/seeds unchanged. Per the architecture-design this task is
  "Existing tests that must change: None → ready". Adding new cases to a shared smoke file is not a
  change to an existing case; I flag it for visibility and will not alter any existing assertion.

---

## 8. Open decisions to confirm (surfaced, not assumed)
1. **Exercise existence not validated** — unknown `exerciseId` → `200` null metrics (per confirmed
   contract). Confirm this is intended (no `EXERCISE_NOT_FOUND` here).
2. **Single shared `PersonalRecordMetricDto`** (optional `volume`/`oneRepMax`) vs three distinct
   metric DTO classes. Plan uses the shared DTO.
3. **Volume conversion** = `fromBaseAsync(volumeKg, unit)` (single 2-dp rounding) vs
   `reps × convertedWeight`. Plan uses the former.

No new dependencies. No new env vars. No DB/diagram change.

---

**STOP — awaiting plan approval before Phase 2 (implementation).**
