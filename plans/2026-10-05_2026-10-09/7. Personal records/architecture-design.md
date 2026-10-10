# Architecture Design — Task 7: Personal records (PRs)

- **Task:** `7. Personal records` — Feature **F7**.
- **Depends on:** Task 2 (user), Task 4 (unit), Task 5 (workout data), **Task 3 (exercise — for
  exercise-existence validation; see note below)**. Independent of Task 6.
  > **Added dependency (2026-10-10 human decision):** the PR endpoint now validates the exercise
  > exists (unknown `exerciseId` → 404 `EXERCISE_NOT_FOUND`), so it injects `IExerciseService` and
  > reuses `ExerciseByIdNotFoundException` from Task 3. The task's `description.txt` (product-owner
  > owned) still lists the original `Depends on:` chain; this design records the added Task 3
  > dependency. Flag to the product-owner so the description can be reconciled.
- **Goal:** Return a user+exercise's three PRs — max weight, max volume (reps×weight), best Epley
  1RM (`weight×(1+reps/30)`) — each with its achievement date, in the required output unit, computed
  on normalized kg and index-backed at 50k+.

See `architecture.md` §3 (PR expression indexes), §6, §9.

## Database changes

- **None** — reuses Task 5 schema and its three PR expression/descending indexes
  (`..._weight_kg`, `..._volume`, `..._epley`). No new migration.

## API changes

- **`GET /api/personal-record`** (`@ApiTags('Personal records')`,
  `@ApiOperation({ summary: 'Get personal records for an exercise' })`). New. 200.
  - Query DTO `GetPersonalRecordQueryDto` (`get-personal-record-query.dto.ts`): `userId` (uuid,
    required), `exerciseId` (uuid, required), `unit` (**required** — `weightUnitJoiSchema`;
    omission → 400).
  - 200 → `PersonalRecordDto` = `{ userId, exerciseId, unit, maxWeight, maxVolume, best1Rm }` where
    each metric is a `PersonalRecordMetricDto | null`:
    - `maxWeight`: `{ weight, reps, achievedAt }` (weight in requested unit).
    - `maxVolume`: `{ volume, reps, weight, achievedAt }` (volume and weight in requested unit).
    - `best1Rm`: `{ oneRepMax, reps, weight, achievedAt }` (oneRepMax and weight in requested unit).
    - **Known** user + **known** exercise with no logged sets → each metric is **null**
      (empty-but-not-an-error, 200).
  - Flow: validate request (Joi) → domain checks **validate user exists** then **validate exercise
    exists** → aggregate. (Validating the exercise first, before aggregation, is what turns an
    unknown exercise into a 404 rather than a 200 with null metrics.)
  - Errors:
    - 400 `VALIDATION_ISSUE` — missing/invalid `unit` or ids.
    - 404 `USER_NOT_FOUND` (`UserByIdNotFoundException`) — unknown user.
    - 404 `EXERCISE_NOT_FOUND` (`ExerciseByIdNotFoundException`, reused from Task 3) — unknown
      `exerciseId` (2026-10-10 decision — mirrors the Q9 unknown-user rule for consistency).
    - A **known** user + **known** exercise with **no sets** → **200** with null metrics (NOT an
      error) — the distinction to preserve.

## Aggregation (index-backed)

Each metric is a top-1 index scan over `workout_sets` filtered by `(user_id, exercise_id)`:
- max weight: `ORDER BY weight_kg DESC, performed_at ASC, id ASC LIMIT 1`.
- max volume: `ORDER BY (reps*weight_kg) DESC, performed_at ASC, id ASC LIMIT 1`.
- best 1RM: `ORDER BY (weight_kg*(1+reps/30.0)) DESC, performed_at ASC, id ASC LIMIT 1`.
Tie-break earliest `performed_at` (first achieved). All computed on **kg**; converted to the
requested unit only for display (`fromBaseAsync`, 2 dp). Volume/1RM are derived from the kg
weight of the winning row.

## Environment variables

None.

## Contract

- Extend core `IWorkoutService` with
  `getPersonalRecordsAsync(criteria: PersonalRecordCriteria): Promise<PersonalRecordAggregate>` —
  returns the three winning rows (kg values + reps + `achievedAt`), each nullable.
  `PersonalRecordCriteria` (`src/models/criteria/personal-record-criteria.ts`): `userId`,
  `exerciseId`, optional `from`/`to` (used by Task 8; omitted = all-time).
  `PersonalRecordAggregate` (`src/models/results/personal-record-aggregate.ts`): `maxWeight`,
  `maxVolume`, `best1Rm` each `{ weightKg, reps, volumeKg?, oneRepMaxKg?, achievedAt } | null`.
- API `personal-record` module `src/modules/apis/personal-record/`:
  - `services/personal-record-query/` → `IPersonalRecordQueryService.getAsync` orchestrating:
    validate user exists (`IUserService.existsByIdAsync` / `getByIdAsync` → `UserByIdNotFoundException`);
    **validate exercise exists** (`IExerciseService.existsByIdAsync` → `ExerciseByIdNotFoundException`);
    call `getPersonalRecordsAsync`; convert kg → requested unit; build `PersonalRecordDto`. Token
    `SERVICE__PERSONAL_RECORD_QUERY`. The API module imports `ExerciseModule` (Task 3) in addition to
    `UserModule`, `ScaleUnitModule`, and the core `WorkoutModule`.
  - `personal-record-api.module.ts`, `personal-record-api.controller.ts` (`getAsync`), `dto/`.

## Reuse note for Task 8

`getPersonalRecordsAsync` accepts an optional `from`/`to` range and the delta/period logic in Task 8
calls it twice (current & previous period) — the aggregation is defined once here and reused.

## Tests to define (in-memory DB)

- `src/modules/cores/workout/services/workout/workout.service.spec.ts` — add
  `describe('getPersonalRecordsAsync')`: computes each metric correctly; tie-break picks earliest
  `performed_at`; no data → all nulls; range-bounded variant (seeded rows in/out of range).
- `src/modules/apis/personal-record/services/personal-record-query/personal-record-query.service.spec.ts`:
  `describe('getAsync')` — happy path with unit conversion; unknown user → `UserByIdNotFoundException`;
  **unknown exercise → `ExerciseByIdNotFoundException`** (asserted before any aggregation runs);
  **known user + known exercise with no sets → 200 with null metrics (not an error)**; verifies
  volume/1RM derived from kg then converted.
- `src/modules/apis/personal-record/personal-record-api.controller.spec.ts`: `describe('getAsync')` —
  missing `unit` → `ValidationException`; returns `PersonalRecordDto`.

## Existing tests that must change

- **None.** (Extends `IWorkoutService`.) → **ready**.

## Files to create/change

API `personal-record/` tree (the module imports `ExerciseModule` from Task 3 for exercise-existence
validation, alongside `UserModule`, `ScaleUnitModule`, `WorkoutModule`); `personal-record-criteria.ts`,
`personal-record-aggregate.ts`; extend core `IWorkoutService` + impl. Change: register
`PersonalRecordApiModule` in `app.module.ts`.

## Done when

`pnpm nx test api` passes (metric + null + tie-break + unknown-exercise branches); `pnpm nx build api`
succeeds; aggregation index-backed; missing `unit` → 400; unknown user → 404 `USER_NOT_FOUND`;
unknown exercise → 404 `EXERCISE_NOT_FOUND`; known user + known exercise, no sets → 200 null metrics;
conventions met.
