# Implementation Plan — Task 5: Log a workout entry (including bulk)

- **Task:** `5. Log workout entry (incl. bulk)` — Feature **F5**.
- **Depends on:** Task 2 (user), Task 3 (exercise/muscle-group), Task 4 (scale-unit conversion).
- **Design source:** this task's `architecture-design.md` (confirmed) + `architecture.md` §2.5–2.8,
  §3, §5, §8. This plan does not deviate from the contract; open decisions needing sign-off are in
  the **Decisions to confirm** section at the end.

Phase: **PLAN ONLY** — no production code written yet. Awaiting approval before implementing.

---

## 1. Branch / PR plan (stacked)

- Task 5 **Depends on 2, 3, 4**. Per the sprint's linear-stacking rule (shared cumulative files —
  `app.module.ts`, `app.module.smoke.spec.ts`, `database-diagram.txt`), stack on the **previous**
  task only.
- Branch: **`feat/5-log-workout-entry`** created **off `feat/4-unit-conversion-registry`** (the
  current branch; tasks 2/3/4 are included transitively).
- Draft PR **base = `feat/4-unit-conversion-registry`**, so the diff shows only Task 5's changes.
- Open as a **draft** (`gh pr create --draft`); do not mark ready (reviewer + QA gate first).

---

## 2. Changes — files to create / change (exact paths)

### 2.1 Core `workout` module — `apps/api/src/modules/cores/workout/`

| File | Purpose |
| ---- | ------- |
| `entities/workout-entry.entity.ts` | `WorkoutEntryEntity implements IImmutableEntity` — parent row. Columns per §2.5: `id` (uuid PK `pk_workout_entries`), `user_id`, `exercise_id`, `performed_at` (`timestamptz`), `created_time`. `@OneToMany` to `WorkoutSetEntity`. No `updated_time` (append-only). |
| `entities/workout-set.entity.ts` | `WorkoutSetEntity implements IImmutableEntity` — fact row. Columns per §2.6: `id` (uuid PK `pk_workout_sets`), `workout_entry_id` FK, denormalized `user_id`/`exercise_id`/`performed_at`, `set_number` (`smallint`), `reps` (`integer`), `weight` (`numeric(7,3)`), `unit` (`varchar(8)`), `weight_kg` (`numeric(9,4)`), `created_time`. `@ManyToOne` back to entry. Numeric columns use a `ColumnNumericTransformer` so reads return JS `number` (not the driver's string) — see Decisions. |
| `exceptions/workout-set-already-exists.exception.ts` | `WorkoutSetAlreadyExistsException extends BusinessException` → `WORKOUT_ALREADY_EXISTS`, HTTP **409** (enum member already present in `business-exception-codes.ts`). Constructor takes the conflicting `(userId, exerciseId, performedAt, setNumber)` for the message. |
| `services/workout/workout-service.interface.ts` | `IWorkoutService` with `createManyAsync(options: CreateWorkoutOptions): Promise<WorkoutEntryEntity[]>` (returns each parent with its `sets` populated). History/PR methods are added in Tasks 6/7 on this same interface — out of scope here. |
| `services/workout/workout.service.ts` | `WorkoutService implements IWorkoutService` — data access. Injects `@InjectDataSource() DataSource` and `ITimeContext`. Transactional bulk insert (see §4). Translates Postgres `23505` → `WorkoutSetAlreadyExistsException`; rethrows anything else (reuse the `__isUniqueViolation` shape from `ExerciseService`). |
| `services/workout/workout-injection-tokens.ts` | `WorkoutServiceInjectionTokens { SERVICE__WORKOUT = 'SERVICE__WORKOUT' }`. |
| `services/workout/workout.service.module.ts` | `WorkoutServiceModule` — `TypeOrmModule.forFeature([WorkoutEntryEntity, WorkoutSetEntity])` + `TimeContextModule`; provides `SERVICE__WORKOUT` via `useClass: WorkoutService`; exports the token. |
| `workout.module.ts` | `WorkoutModule` — imports/exports `WorkoutServiceModule` (so downstream F6/F7 can inject `SERVICE__WORKOUT`). |

### 2.2 Shared model — `apps/api/src/models/options/`

| File | Purpose |
| ---- | ------- |
| `create-workout-options.ts` | `CreateWorkoutOptions` — `{ userId: string; entries: CreateWorkoutEntryOption[] }`. Per the one-declaration-per-file rule, the nested option types get their own files: `create-workout-entry-option.ts` (`{ exerciseId, performedAt: Date, sets: CreateWorkoutSetOption[] }`) and `create-workout-set-option.ts` (`{ setNumber, reps, weight, unit, weightKg }`). All fully computed by the orchestration service before reaching the core service. |

### 2.3 API `workout` module — `apps/api/src/modules/apis/workout/`

| File | Purpose |
| ---- | ------- |
| `services/workout-logging/workout-logging-service.interface.ts` | `IWorkoutLoggingService.logAsync(options): Promise<WorkoutEntryEntity[]>` — orchestration contract. |
| `services/workout-logging/workout-logging.service.ts` | `WorkoutLoggingService` — orchestrates the §4 request-flow stages: domain checks (user exists, each exercise exists), normalize each set via `IScaleUnitConversionService.toBaseAsync`, assign `set_number` per entry (1-based array order), build `CreateWorkoutOptions`, call `IWorkoutService.createManyAsync`. Injects `SERVICE__USER`, `SERVICE__EXERCISE`, `SERVICE__SCALE_UNIT_CONVERSION`, `SERVICE__WORKOUT`. |
| `services/workout-logging/workout-logging-injection-tokens.ts` | `WorkoutLoggingServiceInjectionTokens { SERVICE__WORKOUT_LOGGING = 'SERVICE__WORKOUT_LOGGING' }`. |
| `services/workout-logging/workout-logging.service.module.ts` | Provides `SERVICE__WORKOUT_LOGGING`; imports `UserModule`, `ExerciseModule`, `ScaleUnitModule`, `WorkoutModule`; exports the token. |
| `workout-api.controller.ts` | `WorkoutApiController` — `@ApiTags('Workouts')`, `@Controller({ path: 'workout' })` (resolves to `/api/workout`, **not** `/api/api/workout`). `createAsync(@Body() payload)` — `@Post()`, `@HttpCode(201)`. Validates via `JoiService` → delegates to `IWorkoutLoggingService.logAsync` → maps to `LogWorkoutResultDto`. Thin; no DB/logic. |
| `workout-api.module.ts` | `WorkoutApiModule` — imports `WorkoutLoggingServiceModule` + `JoiServiceModule`; declares the controller. |
| `dto/workout-set-payload.dto.ts` | `WorkoutSetPayload` request shape (`reps`, `weight`, `unit`). |
| `dto/workout-entry-payload.dto.ts` | `WorkoutEntryPayload` (`exerciseId`, `performedAt`, `sets: WorkoutSetPayload[]`). |
| `dto/create-workout-payload.dto.ts` | `CreateWorkoutPayloadDto` (`userId`, `entries: WorkoutEntryPayload[]`). |
| `dto/create-workout-payload.joi-schema.ts` | Joi schema composing `userIdJoiSchema.required()`, `weightUnitJoiSchema.required()`; `performedAt = Joi.string().isoDate().required()`; `reps = Joi.number().integer().positive().required()`; `weight = Joi.number().positive().required()`; `sets`/`entries` `.min(1).required()`. Typed `Joi.ObjectSchema<CreateWorkoutPayloadDto>`. |
| `dto/logged-workout-set.dto.ts` | `LoggedWorkoutSetDto` (`id`, `setNumber`, `reps`, `weight`, `unit`, `weightKg`) + `fromEntity`. |
| `dto/logged-workout-entry.dto.ts` | `LoggedWorkoutEntryDto` (`id`, `exerciseId`, `performedAt`, `sets: LoggedWorkoutSetDto[]`) + `fromEntity`. |
| `dto/log-workout-result.dto.ts` | `LogWorkoutResultDto` (`{ entries: LoggedWorkoutEntryDto[] }`) + `fromEntities`. |

### 2.4 Migration — `apps/api/src/migrations/<timestamp>-CreateWorkoutTables.ts`

`CreateWorkoutTables<timestamp> implements MigrationInterface` (mirrors `CreateExerciseCatalogue`):

- `up()`:
  - Create `workout_entries` (`Table`): columns per §2.5; PK `pk_workout_entries`.
  - Create `workout_sets` (`Table`): columns per §2.6; PK `pk_workout_sets`.
  - FKs: `fk_workout_entries_user_id` → `users.id`; `fk_workout_entries_exercise_id` →
    `exercises.id`; `fk_workout_sets_workout_entry_id` → `workout_entries.id`. (The denormalized
    `user_id`/`exercise_id` on sets are not separately FK-constrained — they are copies guaranteed
    by the same transaction; matches §3's denormalization rationale. **Confirm** in Decisions.)
  - Unique constraint (`TableIndex`, `isUnique`):
    `uq_workout_sets_user_id_exercise_id_performed_at_set_number` on
    `(user_id, exercise_id, performed_at, set_number)` — duplicate rejection (Q8).
  - History indexes (`ix_workout_entries_user_id_performed_at_id` on
    `(user_id, performed_at DESC, id DESC)`; `ix_workout_entries_user_id_exercise_id_performed_at`)
    and the PR indexes on `workout_sets` (`..._weight_kg`, `..._volume`, `..._epley`,
    `..._performed_at`). The **descending / expression** ones (volume `((reps*weight_kg))`, Epley
    `((weight_kg*(1+reps/30.0)))`, and the `DESC` orderings) are declared with **raw SQL**
    (`queryRunner.query('CREATE INDEX ...')`), since TypeORM's `TableIndex` cannot express computed
    expressions or per-column sort direction. A comment documents why.
- `down()`: drop `workout_sets` first (child FK), then `workout_entries` — including all
  constraints/indexes (dropping the tables cascades their indexes).

> These PR/history indexes are declared **here in Task 5** per this task's `architecture-design.md`
> (§Database changes explicitly lists all six on this migration), even though they are *consumed* by
> F6/F7/F8. This keeps one schema-change-per-table migration and avoids an ALTER later.

### 2.5 Wiring / shared-file changes

| File | Change |
| ---- | ------ |
| `apps/api/src/app/app.module.ts` | Add `WorkoutApiModule` to `imports`. |
| `apps/api/src/app/app.module.smoke.spec.ts` | Add `workout_entries` + `workout_sets` DDL to the pg-mem bootstrap (incl. the unique constraint), register both entities, and add the §6 smoke assertions. |
| `docs/designs/database-diagram.txt` | Add the two tables + `Ref:`s (see §3). |

No new environment variables (architecture-design §Environment variables: **None**). README / `.env.api`
untouched.

---

## 3. DBML diagram update (`docs/designs/database-diagram.txt`)

Append two `Table` blocks mirroring §2.5/§2.6 and the ER diagram, and update the "Shipped so far"
header to add Task 5:

- `Table workout_entries` — `id` (pk, `pk_workout_entries`), `user_id`, `exercise_id`,
  `performed_at` (UTC), `created_time`; `Indexes { (user_id, performed_at, id) [name:
  'ix_workout_entries_user_id_performed_at_id']; (user_id, exercise_id, performed_at) [name: '...'] }`.
- `Table workout_sets` — all §2.6 columns; `Indexes` block with the unique constraint
  `(user_id, exercise_id, performed_at, set_number) [unique, name: '...']`, plus the weight_kg /
  volume / epley / performed_at PR indexes (expression indexes written in a `note:` since DBML can't
  express computed expressions — documented, consistent with the migration's raw SQL).
- `Ref:`s — `workout_entries.user_id > users.id`, `workout_entries.exercise_id > exercises.id`,
  `workout_sets.workout_entry_id > workout_entries.id`, and the denormalized
  `workout_sets.user_id > users.id` / `workout_sets.exercise_id > exercises.id` (shown as refs to
  match the ER diagram §2.8).

---

## 4. Transaction strategy, set_number, and 23505 translation

**Request-flow order (orchestration service, per `request-flow.md`):**
1. Controller validates `CreateWorkoutPayloadDto` with Joi (shape/types) → `400` on failure.
2. No generic back-end checks.
3. **Domain checks** (before any write): `IUserService.existsByIdAsync(userId)` — false →
   `UserByIdNotFoundException` (404). For every distinct `exerciseId` in the batch,
   `IExerciseService.existsByIdAsync` — false → `ExerciseByIdNotFoundException` (404). Then for each
   set, `IScaleUnitConversionService.toBaseAsync(weight, unit)` → `weightKg` (unknown unit past Joi
   → `UnsupportedScaleUnitException`, 400 — defensive; Joi already blocks unknown units).
4. **Database write** — build `CreateWorkoutOptions` (with computed `weightKg` and assigned
   `setNumber`) and call `IWorkoutService.createManyAsync`.

**`set_number` assignment:** server-side in the orchestration service — for each entry, sets are
numbered by array order starting at **1** (`index + 1`). Never taken from client input. Two
identical sets in the array get distinct `set_number`s → both persist (legitimate repeat);
re-submitting the same batch collides on the unique key → 409.

**All-or-nothing transaction (core service, §8):** `WorkoutService.createManyAsync` wraps the
**entire batch** in one `this.__dataSource.transaction(async (manager) => { ... })`. Inside: for
each entry, `manager.save` the `WorkoutEntryEntity` (id = `uuidv7()`, `createdTime`/`performedAt`
from the computed options / time context), then `manager.save` its `WorkoutSetEntity[]` (denormalized
`user_id`/`exercise_id`/`performed_at` copied from the parent). Any throw inside the callback (incl.
a `23505`) rolls back the whole transaction — nothing is persisted. The `transaction()` call is
wrapped in `try/catch`; a Postgres **`23505`** (detected via the `QueryFailedError` /
`driverError.code` shape, same helper as `ExerciseService`) is translated to
`WorkoutSetAlreadyExistsException` (409); any other error is rethrown unchanged. Returns the saved
parents with `sets` attached for the response projection.

`created_time` and (when the caller's `performedAt` needs a default — it is always supplied here)
timestamps come from the injected `TimeContext.getUtcNowAsync()`; `performed_at` is the parsed ISO
string stored as UTC `timestamptz`. No `new Date()`.

---

## 5. Test cases (in-memory pg-mem DB; every branch; exact exception types; ≥80% branch coverage)

### 5.1 `apps/api/src/modules/cores/workout/services/workout/workout.service.spec.ts` — `describe('createManyAsync')`
- Single entry persists a parent `workout_entries` row + one `workout_sets` row per set, with the
  correct `set_number` (1-based), `weight`, `unit`, and `weight_kg`, and `created_time` from the fake
  clock. (happy path, numeric transformer returns numbers)
- Bulk: multiple entries (two exercises, multiple sets each) all persist in **one** call; assert all
  parent + set rows exist and FKs link correctly.
- Two identical sets (same reps/weight) in one entry → **both** persist with distinct `set_number`s
  (1 and 2) — legitimate repeat accepted.
- True duplicate: re-submitting a batch that collides on
  `(user_id, exercise_id, performed_at, set_number)` throws `WorkoutSetAlreadyExistsException`.
- **All-or-nothing rollback:** a batch where the *second* entry collides on the unique key → the
  whole call throws and **nothing** is written (assert `workout_entries` and `workout_sets` counts
  are unchanged / zero after the failure). Exercises the transaction-abort branch.
- Branch: a non-`23505` `QueryFailedError` is rethrown unchanged (mock `DataSource.transaction` /
  repo save to reject with code `23503`).
- Branch: a generic (non-`QueryFailedError`) error is rethrown unchanged.

> pg-mem DDL in this spec mirrors the migration's `workout_entries` + `workout_sets` **including the
> unique constraint** (required for the duplicate/rollback branches). The PR **expression** indexes
> are omitted from the test DDL if pg-mem cannot parse `CREATE INDEX ... ((expr))` — they are not
> needed for logging correctness; this divergence is documented in a comment. (Verified during
> implementation; noted in Decisions.)

### 5.2 `apps/api/src/modules/apis/workout/services/workout-logging/workout-logging.service.spec.ts` — `describe('logAsync')`
Stubbed `IUserService`, `IExerciseService`, `IScaleUnitConversionService`, `IWorkoutService` so each
branch is isolated:
- Happy path (single): user+exercise exist; `toBaseAsync` applied to each set; `set_number` assigned
  1-based; `createManyAsync` called with the correctly built `CreateWorkoutOptions`; returns the
  entries.
- Happy path (bulk, multiple exercises): all exercises existence-checked; options built for every
  entry/set.
- Unit normalization: assert `weightKg` in the options equals the stubbed `toBaseAsync` result, and
  the original `weight`/`unit` are preserved.
- Unknown user → `UserByIdNotFoundException`; `createManyAsync` **not** called.
- Unknown exercise (any one in the batch) → `ExerciseByIdNotFoundException`; `createManyAsync` not
  called (rolls back the whole request before the write).
- Unsupported unit reaching `toBaseAsync` → `UnsupportedScaleUnitException` propagates; no write.
- `set_number` restarts at 1 per entry (two entries each with 2 sets → numbers [1,2],[1,2]).
- Propagates `WorkoutSetAlreadyExistsException` from `createManyAsync` unchanged.

### 5.3 `apps/api/src/modules/apis/workout/workout-api.controller.spec.ts` — `describe('createAsync')`
Real `JoiService` (drives validation branches) + stub `IWorkoutLoggingService`:
- Valid single payload → 201 `LogWorkoutResultDto` mapping entities → DTOs (nested sets).
- Valid bulk payload → maps every entry.
- `ValidationException` (400) for: missing/`null` `userId`; non-uuid `userId`; empty `entries`;
  missing `exerciseId`; non-uuid `exerciseId`; `null`/missing `performedAt`; non-ISO `performedAt`;
  empty `sets`; `reps` ≤ 0; non-integer `reps`; `weight` ≤ 0 (negative + zero); bad/unknown `unit`.
- Propagates `UserByIdNotFoundException`, `ExerciseByIdNotFoundException`,
  `WorkoutSetAlreadyExistsException` from the service unchanged (so the global filter maps them).

### 5.4 Bootstrap smoke — `apps/api/src/app/app.module.smoke.spec.ts` (extend)
- Add `workout_entries` + `workout_sets` DDL (with the unique constraint) to the pg-mem data source,
  register both entities.
- Assert `POST /api/workout` with a valid body (requires seeding a user + exercise row into pg-mem
  first) returns **201** and the `entries` shape — proving the module graph, DI imports, and the
  `toBaseAsync` chain compose through the real `AppModule`.
- Assert a bad body returns **400** (validation reaches the controller).
- Negative: `POST /api/api/workout` returns **404** (no double prefix).
- Also boot once via `pnpm nx serve api` against the live Postgres (migration applied) and probe
  `POST /api/workout`; report observed path + status before opening the PR.

---

## 6. Existing tests touched

**None** (architecture-design §Existing tests that must change: **None → ready**). The only edit to
existing test files is **additive** — extending `app.module.smoke.spec.ts` with new DDL and new
`it(...)` cases; no existing assertion is modified or removed.

---

## 7. Database impact

**Yes** — adds `workout_entries` + `workout_sets` (new migration), so the DB diagram changes
(`docs/designs/database-diagram.txt` updated, §3). No changes to existing tables.

---

## 8. Validation commands (Phase 2, before PR)

1. `pnpm nx test api` (with coverage) — green, branch coverage ≥ 80%.
2. `pnpm nx build api` — compiles.
3. `pnpm nx lint api` — no new lint.
4. Run the new migration up/down against the live `everfit-postgres` and actually `serve` + probe
   `POST /api/workout`; report paths/status.

---

## Decisions to confirm (surface before implementing)

1. **PR/history indexes land in Task 5's migration** (not Task 7). Following this task's
   `architecture-design.md`, which explicitly lists all six on the `CreateWorkoutTables` migration.
   Confirm this is intended rather than deferring the F7 expression indexes to Task 7.
2. **No FK on the denormalized `workout_sets.user_id` / `exercise_id`.** They are copies kept correct
   by the single write transaction (§3 rationale); only `workout_entry_id` (and the parent's
   `user_id`/`exercise_id`) carry FKs. Confirm leaving the denormalized copies unconstrained.
3. **Numeric transformer on `weight` / `weight_kg`.** TypeORM returns `numeric` columns as strings;
   I'll add a shared `ColumnNumericTransformer` (new `apps/api/src/common/entities/` helper) so
   reads return JS `number`s — needed for the response DTO and for F7/F8 aggregation later. Not
   explicitly in the design; flagging the new shared helper file.
4. **pg-mem + expression indexes.** If pg-mem cannot parse the raw expression `CREATE INDEX`
   statements, the in-spec test DDL will omit those PR indexes (keeping the unique constraint, which
   the duplicate/rollback tests need). The real migration keeps them for Postgres. Confirm this
   test/prod DDL divergence is acceptable (it mirrors how the existing specs hand-write DDL).

---

**STOP — awaiting plan approval before writing any production code or opening a PR.**
