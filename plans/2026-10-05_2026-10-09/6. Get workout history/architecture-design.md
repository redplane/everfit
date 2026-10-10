# Architecture Design — Task 6: Get workout history

- **Task:** `6. Get workout history` — Feature **F6**.
- **Depends on:** Task 2 (user), Task 3 (exercise/muscle-group), Task 4 (unit), Task 5 (workout
  data). Independent of Task 7 (parallelizable).
- **Goal:** Retrieve a client's logged workouts — filtered (partial exercise name, UTC date range,
  muscle group), cursor-paginated, weights converted to a required output unit — performant at 50k+.

See `architecture.md` §2.5–2.6, §3 (history indexes), §9.

## Database changes

- **None** — reuses the Task 5 schema and its history indexes
  (`ix_workout_entries_user_id_performed_at_id`,
  `ix_workout_entries_user_id_exercise_id_performed_at`, and the join-table index). No new migration.

## API changes

- **`GET /api/workout-history`** (`@ApiTags('Workouts')`,
  `@ApiOperation({ summary: 'Get workout history' })`). New. 200.
  - Query DTO `GetWorkoutHistoryQueryDto` (`get-workout-history-query.dto.ts`):
    - `userId` (uuid, required — `userIdJoiSchema`).
    - `unit` (**required** — `weightUnitJoiSchema`; omission → 400, no default — M1).
    - `exerciseName` (optional, partial match, trimmed — `exerciseNameJoiSchema`).
    - `muscleGroupId` (optional, uuid).
    - `from` / `to` (optional ISO date-time; UTC range `[from, to]`; cross-field: `to` ≥ `from`,
      else a `ValidationException`).
    - `cursor` (optional, opaque base64) + `limit` (int 1..100, default 20) — `cursorPagerJoiSchema`.
  - 200 → `SearchResult<WorkoutHistoryItemDto>` with `items`, `limit`, `nextCursor` (null at end).
    `WorkoutHistoryItemDto` = `{ entryId, exerciseId, exerciseName, performedAt, unit,
    sets: { setNumber, reps, weight }[] }` where `weight` is converted to the requested `unit`
    (display-only, from `weight_kg`).
  - Errors:
    - 400 `VALIDATION_ISSUE` — missing/invalid `unit`, bad date format, `to < from`, **invalid
      cursor** (`INVALID_CURSOR` surfaced as a `ValidationException`).
    - 404 `USER_NOT_FOUND` — unknown user.
    - Known user, no matching rows → **200 empty** `SearchResult` (not an error).

## Pagination (keyset) & filtering

- Order `performed_at DESC, id DESC` over `workout_entries` under `user_id`. Cursor encodes the last
  seen `(performed_at, id)` (base64 JSON); page predicate `(performed_at, id) < (cursorPerformedAt,
  cursorId)`; fetch `limit + 1` to compute `nextCursor`. Stable under concurrent inserts.
- `exerciseName` → `IExerciseService.resolveIdsByNameLikeAsync` → `exercise_id = ANY(ids)` (empty
  ids ⇒ empty result, no error).
- `muscleGroupId` → `IExerciseService.resolveIdsByMuscleGroupIdAsync` → same `ANY(ids)` predicate.
- `from`/`to` → `performed_at` range predicate (UTC).
- Each returned entry's sets are loaded and each set's `weight_kg` converted via
  `fromBaseAsync(weightKg, unit)`.

## Environment variables

None.

## Contract

- Extend core `IWorkoutService` with
  `searchHistoryAsync(criteria: WorkoutHistorySearchCriteria): Promise<CursorPage<WorkoutEntryEntity
  & { sets }>>` — the keyset query returning entries + their sets (kg values).
  `WorkoutHistorySearchCriteria` (`src/models/criteria/workout-history-search-criteria.ts`): `userId`,
  `exerciseIds?`, `from?`, `to?`, `cursor?` (decoded `{ performedAt, id }`), `limit`.
- API `workout-history` module `src/modules/apis/workout-history/`:
  - `services/workout-history-query/` → `IWorkoutHistoryQueryService.searchAsync` orchestrating:
    validate user exists; resolve exercise-name / muscle-group → exercise ids; decode/validate cursor
    (invalid → `ValidationException`); call `searchHistoryAsync`; convert weights to `unit`; build
    `SearchResult` + `nextCursor`. Token `SERVICE__WORKOUT_HISTORY_QUERY`.
  - `workout-history-api.module.ts`, `workout-history-api.controller.ts` (`searchAsync`), `dto/`.
  - A small cursor codec helper (encode/decode base64) under the module (or `src/common/`).

## Tests to define (in-memory DB)

- `src/modules/cores/workout/services/workout/workout.service.spec.ts` — add
  `describe('searchHistoryAsync')`: no filters (keyset order + `nextCursor` present/null at end);
  exercise-id filter; date-range filter; empty result for a known user; limit boundary (exactly
  `limit` vs `limit+1`).
- `src/modules/apis/workout-history/services/workout-history-query/workout-history-query.service.spec.ts`:
  `describe('searchAsync')` — unknown user → `UserByIdNotFoundException`; missing unit path (rejected
  upstream by Joi — covered in controller spec); partial-name filter resolves ids; muscle-group
  filter; weights converted to requested unit; invalid cursor → `ValidationException`; empty result
  not an error.
- `src/modules/apis/workout-history/workout-history-api.controller.spec.ts`:
  `describe('searchAsync')` — validates query (missing `unit` → `ValidationException`; `to<from` →
  `ValidationException`); returns `SearchResult<WorkoutHistoryItemDto>`.

## Existing tests that must change

- **None.** (Adding a method to `IWorkoutService` extends, not modifies, the Task 5 spec.) → **ready**.

## Files to create/change

API `workout-history/` tree; cursor codec; `workout-history-search-criteria.ts`; extend core
`IWorkoutService` + impl. Change: register `WorkoutHistoryApiModule` in `app.module.ts`.

## Done when

`pnpm nx test api` passes (keyset + filter + unit branches); `pnpm nx build api` succeeds; history is
keyset-paginated and index-backed; missing `unit` → 400; unknown user → 404; empty range → empty
200; conventions met.
