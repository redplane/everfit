# Implementation Plan — Task 6: Get workout history (F6)

Phase 1 — PLAN ONLY. No production code written yet. Awaiting approval before Phase 2.

- **Task folder:** `plans/2026-10-05_2026-10-09/6. Get workout history/`
- **Depends on:** Task 2 (user), Task 3 (exercise/muscle-group), Task 4 (unit conversion), Task 5
  (workout data). Transitively included in the stacked base branch.
- **Confirmed inputs:** `description.txt` (product) + `architecture-design.md` (contract, confirmed)
  + system `architecture.md` (§2.5–2.6 model, §3 indexes, §9 contract). No contradictions found.

---

## 1. Branch / PR plan (linear stack)

- **Branch:** `feat/6-get-workout-history`, created **off `feat/5-log-workout-entry`** (not `main`).
- **PR base:** `feat/5-log-workout-entry` (stacked), so the diff shows only Task 6's changes.
- **One DRAFT PR** for this task. Opened with `gh pr create --draft`. Not marked ready by me —
  that happens only after `reviewer` + (API task) `qa` sign-off.

---

## 2. Scope confirmation

- **Adds one API endpoint:** `GET /api/workout-history` (cursor/keyset paginated, F6).
- **Database impact: NONE.** Verified: the three indexes this read path needs already exist from
  Task 5 and are already in the DBML diagram — no new migration, **no diagram change**:
  - `ix_workout_entries_user_id_performed_at_id` — `(user_id, performed_at DESC, id DESC)` — keyset.
  - `ix_workout_entries_user_id_exercise_id_performed_at` — exercise-filtered keyset.
  - `ix_exercise_muscle_groups_muscle_group_id` — muscle-group → exercise-id resolution.
  (Confirmed in `apps/api/src/migrations/1791610517255-CreateWorkoutTables.ts`,
  `apps/api/src/migrations/1791598814087-CreateExerciseCatalogue.ts`, and
  `docs/designs/database-diagram.txt` lines 62–63.)
- **Environment variables: NONE added.** No README / `.env.api` change.

---

## 3. Files to create / change (exact paths)

### 3.1 Core — `src/modules/cores/workout/` (extend, do not rewrite)

1. **CHANGE** `services/workout/workout-service.interface.ts` — add one method to `IWorkoutService`
   (extends, does not modify existing `createManyAsync`):
   ```ts
   searchHistoryAsync(criteria: WorkoutHistorySearchCriteria): Promise<CursorPage<WorkoutEntryEntity>>;
   ```
   Returns the page's parent entries, each with `sets` populated (kg values as stored). The core
   service does NOT resolve exercise names or convert units — that is orchestration's job (keeps the
   data-access service focused, per the architecture contract).

2. **CHANGE** `services/workout/workout.service.ts` — implement `searchHistoryAsync`:
   - Inject the existing repositories (add `@InjectRepository(WorkoutEntryEntity)` and
     `WorkoutSetEntity`) alongside the current `DataSource`/time context, mirroring neighbours.
   - Build the keyset query (details in §4). Fetch `limit + 1` parent rows to detect a next page.
   - Load the sets for the page's entry ids in **one** query (`In(entryIds)`), group onto each entry
     (no N+1), order sets `set_number ASC`.
   - Return `{ items: WorkoutEntryEntity[] (≤ limit, sets attached), hasMore: boolean }`.

### 3.2 Shared models — `src/models/criteria/` and `src/common/models/`

3. **CREATE** `src/models/criteria/workout-history-search-criteria.ts` — `WorkoutHistorySearchCriteria`:
   ```ts
   interface WorkoutHistorySearchCriteria {
     userId: string;
     exerciseIds?: string[];                       // resolved + intersected; undefined = no exercise filter
     from?: Date;
     to?: Date;
     cursor?: { performedAt: Date; id: string };   // decoded keyset position
     limit: number;
   }
   ```
   (Mirrors `exercise-search-criteria.ts`.)

4. **CREATE** `src/common/models/cursor-page.ts` — generic keyset page envelope returned by core
   keyset reads:
   ```ts
   interface CursorPage<T> { items: T[]; hasMore: boolean; }
   ```
   (Complements the existing input `CursorPager` and the response `SearchResult<T>`.)

### 3.3 API module — `src/modules/apis/workout-history/` (new, mirrors `apis/workout/`)

5. **CREATE** `workout-history-api.controller.ts` — `@ApiTags('Workouts')`, `@Controller({ path:
   'workout-history' })` (resolves to `/api/workout-history`; path must NOT repeat the global `api`
   prefix). `GET` handler `searchAsync(@Query() query)`:
   - Stage 2: validate via injected `JoiService` against `getWorkoutHistoryQueryJoiSchema`.
   - Stage 4/5: delegate to `IWorkoutHistoryQueryService.searchAsync(instance)`.
   - Return `SearchResult<WorkoutHistoryItemDto>` (built by the orchestration service). Thin.

6. **CREATE** `workout-history-api.module.ts` — imports `WorkoutHistoryQueryServiceModule` +
   `JoiServiceModule`; declares the controller. (Mirrors `workout-api.module.ts`.)

7. **CREATE** `dto/get-workout-history-query.dto.ts` — `GetWorkoutHistoryQueryDto` with Swagger
   decorators: `userId` (required uuid), `unit` (required), `exerciseName?`, `muscleGroupId?`,
   `from?`, `to?`, `cursor?`, `limit?` (default 20).

8. **CREATE** `dto/get-workout-history-query.joi-schema.ts` — `getWorkoutHistoryQueryJoiSchema`,
   composed from the shared reusable schemas so rules never drift:
   ```ts
   cursorPagerJoiSchema.keys({
     userId: userIdJoiSchema.required(),            // omission/!uuid -> 400
     unit: weightUnitJoiSchema.required(),          // REQUIRED (M1); omission/unknown -> 400
     exerciseName: exerciseNameJoiSchema.optional(),
     muscleGroupId: Joi.string().uuid().optional(),
     from: Joi.date().iso().optional(),
     to: Joi.date().iso().optional(),
   }).custom(to >= from)   // cross-field: to < from -> ValidationException (400)
   ```
   (`cursor` + `limit` come from `cursorPagerJoiSchema`; `cursor` stays an opaque string here — its
   structural validity is checked at decode time, surfaced as `INVALID_CURSOR` → 400.)

9. **CREATE** `dto/workout-history-item.dto.ts` — `WorkoutHistoryItemDto`
   `{ entryId, exerciseId, exerciseName, performedAt, unit, sets: WorkoutHistorySetDto[] }`, where
   `unit` is the **requested** output unit. Built via a static factory from an entry + resolved
   exercise name + the requested unit + pre-converted set DTOs.

10. **CREATE** `dto/workout-history-set.dto.ts` — `WorkoutHistorySetDto`
    `{ setNumber, reps, weight, originalWeight, originalUnit }` where `weight` = `weight_kg` converted
    to the requested unit (2 dp, display-only) and `originalWeight`/`originalUnit` retain exactly
    what the coach entered (M2: "also return the original weight+unit as entered").

11. **CREATE** `services/workout-history-query/workout-history-query-service.interface.ts` —
    `IWorkoutHistoryQueryService.searchAsync(query: GetWorkoutHistoryQueryDto):
    Promise<SearchResult<WorkoutHistoryItemDto>>`.

12. **CREATE** `services/workout-history-query/workout-history-query.service.ts` — orchestration
    (details §5). Injects `SERVICE__USER`, `SERVICE__EXERCISE`, `SERVICE__SCALE_UNIT_CONVERSION`,
    `SERVICE__WORKOUT`.

13. **CREATE** `services/workout-history-query/workout-history-query-injection-tokens.ts` — enum
    `WorkoutHistoryQueryServiceInjectionTokens { SERVICE__WORKOUT_HISTORY_QUERY = '...' }`.

14. **CREATE** `services/workout-history-query/workout-history-query.service.module.ts` — provides the
    service via the token; imports `UserModule`, `ExerciseModule`, `ScaleUnitModule`, `WorkoutModule`
    (the core modules that re-export the needed service tokens); exports the token. (Mirrors
    `workout-logging.service.module.ts`.)

15. **CREATE** `services/workout-history-query/workout-history-cursor.codec.ts` — pure helper
    (no DI): `encodeCursor({ performedAt, id }): string` and `decodeCursor(raw: string): {
    performedAt: Date; id: string } | null` (returns `null` on any malformed input; the orchestration
    turns `null` into a `ValidationException`). Design in §4.

### 3.4 Composition root

16. **CHANGE** `src/app/app.module.ts` — import and register `WorkoutHistoryApiModule` in `imports`
    (the one wiring change; caught by the smoke test if missed/mis-exported).

---

## 4. Cursor design & keyset SQL

### Opaque cursor
- Encodes the last-seen `(performed_at, id)` of the previous page.
- `encodeCursor`: `base64url(JSON.stringify({ p: performedAt.toISOString(), i: id }))`.
- `decodeCursor`: base64-decode → `JSON.parse` → validate `p` is a parseable ISO date **and** `i` is
  a UUID; on any failure (bad base64, bad JSON, missing/invalid fields) return `null`. No throwing in
  the pure helper — the caller decides the exception, so the codec is trivially unit-testable.
- Why `(performed_at, id)`: `id` is UUID v7 (time-ordered) and is the PK tiebreaker in the keyset
  index `(user_id, performed_at DESC, id DESC)`, giving a **total, stable** order even when several
  entries share a `performed_at`. Stable under concurrent inserts (keyset, not offset).

### Keyset query (on `workout_entries`, QueryBuilder)
```
WHERE entry.user_id = :userId
  [ AND entry.exercise_id IN (:...exerciseIds) ]      -- only when an exercise/muscle filter applied
  [ AND entry.performed_at >= :from ]
  [ AND entry.performed_at <= :to ]
  [ AND (entry.performed_at < :cursorP
         OR (entry.performed_at = :cursorP AND entry.id < :cursorId)) ]   -- only when cursor present
ORDER BY entry.performed_at DESC, entry.id DESC
LIMIT :limit + 1
```
- The keyset predicate is written in **expanded** form `(a < p OR (a = p AND b < c))` rather than the
  SQL row-value form `(a, b) < (p, c)` because **pg-mem** (the in-memory test DB) does not support
  row-value comparison; the expanded form is semantically identical and index-eligible on real
  Postgres.
- **limit+1 → nextCursor:** fetch `limit + 1` rows; if more than `limit` returned, `hasMore = true`
  and we trim to `limit`; the orchestration sets `nextCursor = encodeCursor(lastItem)`. Otherwise
  `hasMore = false` and `nextCursor = null` (end of history).

### Filter → SQL translation (AND semantics)
- `exerciseName` → `IExerciseService.resolveIdsByNameLikeAsync(term)` → id set.
- `muscleGroupId` → `IExerciseService.resolveIdsByMuscleGroupIdAsync(id)` → id set.
- When **both** are present, the orchestration **intersects** the two id sets (filters AND together).
- The combined id set (one filter, or the intersection) becomes `exercise_id IN (:ids)`.
- **Empty id set short-circuit:** if any applied filter resolves to `[]` (or the intersection is
  empty), the orchestration returns an **empty `SearchResult`** immediately (`items: []`,
  `nextCursor: null`) — a known user with no matching data is **not an error** (never calls the DB).
- `from` / `to` → `performed_at` range (inclusive `[from, to]`, UTC; `Joi.date().iso()` coerces).

---

## 5. Orchestration flow (`WorkoutHistoryQueryService.searchAsync`)

1. **Domain check — user exists:** `userService.existsByIdAsync(userId)`; if not →
   `UserByIdNotFoundException(userId)` → **404 USER_NOT_FOUND**. (Reuses the existing core exception.)
2. **Resolve filters → exercise ids** (as §4). Empty result ⇒ return empty `SearchResult` (not error).
3. **Decode cursor** (if present) via `decodeCursor`; `null` → throw
   `new ValidationException([new ValidationIssue('cursor: invalid or malformed cursor')])` → **400**
   (`INVALID_CURSOR` class of error, surfaced as a validation issue per architecture §5).
4. **Query core:** `workoutService.searchHistoryAsync({ userId, exerciseIds?, from?, to?, cursor?,
   limit })` → `CursorPage<WorkoutEntryEntity>` (entries + sets).
5. **Resolve exercise names** for the page: fetch each distinct `exerciseId` via
   `exerciseService.getByIdAsync` (bounded by distinct exercises on the page ≤ limit; reuses the
   existing Task 3 contract — **no modification to `IExerciseService`**). Build an id→name map.
   *(Decision point — see §8.)*
6. **Convert weights:** for every set, `weight = await scaleUnitConversionService.fromBaseAsync(
   set.weightKg, unit)` (2 dp display), keeping `originalWeight = set.weight`,
   `originalUnit = set.unit`.
7. **Build result:** map entries → `WorkoutHistoryItemDto` (with `unit` = requested unit);
   `nextCursor = page.hasMore ? encodeCursor(lastItem) : null`. Return
   `{ items, limit, nextCursor }` (no `offset`/`total` — cursor list).

---

## 6. Test cases to be covered (new tests; every branch; exact exception types; pg-mem in-memory DB)

### 6.1 `cores/workout/services/workout/workout.service.spec.ts` — ADD `describe('searchHistoryAsync')`
(Extends the existing `createManyAsync` spec; the pg-mem DDL already has `workout_entries` /
`workout_sets`.)
- Returns entries in keyset order `performed_at DESC, id DESC` with their sets attached (set order).
- First page: with `limit` smaller than total → returns exactly `limit` items and `hasMore = true`.
- Next page: passing the previous page's `cursor` returns the following rows (no overlap, no gap).
- Last page: `hasMore = false` when the remaining rows ≤ `limit`.
- Limit boundary: exactly `limit` rows available → `hasMore = false`; `limit + 1` → `hasMore = true`.
- `exerciseIds` filter → only those entries (`IN` predicate).
- Date-range filter (`from`/`to`, each alone and combined) → only in-range entries.
- Cursor with equal `performed_at` across rows → tiebreaks by `id DESC` (stability branch).
- Empty result for a known user with no rows → `{ items: [], hasMore: false }` (no throw).

### 6.2 `workout-history-cursor.codec.spec.ts` — NEW
- `describe('encodeCursor')`: produces a base64url string; round-trips with `decodeCursor`.
- `describe('decodeCursor')`:
  - valid encoded cursor → `{ performedAt: Date, id }`.
  - not base64 / not JSON → `null`.
  - JSON missing `p` or `i` → `null`.
  - `p` not a valid date → `null`; `i` not a UUID → `null`.

### 6.3 `apis/workout-history/services/workout-history-query/workout-history-query.service.spec.ts` — NEW
`describe('searchAsync')`, with faked core services (and a real codec):
- Unknown user → `UserByIdNotFoundException` (exact type).
- Happy path, no filters → `SearchResult<WorkoutHistoryItemDto>`; weights converted to requested
  `unit`; `originalWeight`/`originalUnit` retained; `nextCursor` present when `hasMore`, `null` else.
- Partial-name filter → `resolveIdsByNameLikeAsync` called; resolved ids passed to core.
- Muscle-group filter → `resolveIdsByMuscleGroupIdAsync` called; ids passed to core.
- Both filters → id sets **intersected**; intersection passed to core.
- Filter resolves to empty ids → empty `SearchResult`, core `searchHistoryAsync` **not** called
  (no error).
- Invalid cursor (`decodeCursor` → null) → `ValidationException` (exact type).
- Valid cursor → decoded `{ performedAt, id }` passed to core.
- Output-conversion correctness: `fromBaseAsync(weightKg, unit)` result lands in `weight` (2 dp).
- Exercise-name resolution: `getByIdAsync` used to populate `exerciseName` per distinct id.

### 6.4 `apis/workout-history/workout-history-api.controller.spec.ts` — NEW
`describe('searchAsync')`, with the real `JoiService` + a faked query service:
- Valid query → delegates to the query service; returns its `SearchResult`.
- Missing `unit` → `ValidationException` (400) — query service not called.
- Unsupported `unit` → `ValidationException`.
- Missing/invalid `userId` → `ValidationException`.
- `to < from` → `ValidationException` (cross-field).
- `limit` defaulting (omitted → 20) and out-of-range (`>100`) → `ValidationException`.

### 6.5 `app/app.module.smoke.spec.ts` — EXTEND (required standing policy)
Add a `describe('AppModule (bootstrap smoke) — workout history (F6)')` block that boots the **real
`AppModule`** over a seeded pg-mem DataSource (user + exercise + a couple of `workout_entries` /
`workout_sets`), applying the `api` global prefix as `main.ts` does, and asserts:
- `GET /api/workout-history?userId=<seeded>&unit=kg` → **200**, `items` is an array, `limit` present.
- `GET /api/workout-history?userId=<seeded>` (no `unit`) → **400** (required-unit rejected at boot).
- `GET /api/workout-history?userId=<unknown>&unit=kg` → **404** `USER_NOT_FOUND`.
- Negative: `GET /api/api/workout-history` → **404** (the double-prefixed path must NOT exist).
This fails on the export/import/DI/path class of bug that provider-level specs cannot catch.

**Coverage target:** ≥ 80% branch coverage across the new/changed code (every `if`/guard above has a
dedicated case). I will also actually `pnpm nx serve api` and probe the endpoint before opening the
PR, reporting observed paths/status codes.

---

## 7. Existing tests touched

- **None modified or deleted.** `workout.service.spec.ts` is **extended** with a new `describe`
  (adding cases, not changing existing ones); `app.module.smoke.spec.ts` is **extended** with a new
  `describe`. No existing assertion changes → no test-change gate triggered (architecture-design §
  "Existing tests that must change: None → ready").

---

## 8. Decisions / things to surface before implementing

1. **Exercise-name resolution for the page (§5.5).** The response DTO includes `exerciseName`
   (per the architecture contract). `IExerciseService` exposes `getByIdAsync` (single) but no batch
   getter. **Plan:** resolve names by calling `getByIdAsync` once per *distinct* exercise id on the
   page (bounded ≤ limit; the catalogue is tiny) — this **reuses the existing Task 3 contract with no
   modification**. If you'd prefer to avoid the per-id calls, the alternative is a new
   `getByIdsAsync(ids)` batch method on `IExerciseService` — but that *extends Task 3's interface*,
   so I will only add it with approval. **Proposed: keep the per-distinct-id approach** (no upstream
   change). Please confirm.
2. **Set DTO shape (§3.3 #10).** The architecture item sketch lists `sets: { setNumber, reps,
   weight }`, while the task body also requires returning the original weight+unit. I plan to include
   both: `weight` (converted) + `originalWeight` + `originalUnit`. Flagging the field-name additions
   (`originalWeight`/`originalUnit`) for confirmation; the product `description.txt` is unchanged by
   this (any wording tweak would go through the product-owner).
3. **New shared type `CursorPage<T>`** added under `src/common/models/` — a small, reusable keyset
   envelope (distinct from `SearchResult<T>` which is the wire shape). Confirm the location is
   acceptable (consistent with the existing `cursor-pager.ts` / `search-result.ts`).

No new environment variables, no new third-party dependencies, no schema/diagram/migration change.

---

## 9. Done when (Phase 2 exit)

`pnpm nx test api` green (keyset + filter + unit + cursor + 404/400 branches, ≥80% branch coverage);
`pnpm nx build api` compiles; `pnpm nx lint api` clean for new code; app boots and
`GET /api/workout-history` probed live; one **draft** PR opened on branch `feat/6-get-workout-history`
with base `feat/5-log-workout-entry` (stacked), pending `reviewer` + `qa`.
