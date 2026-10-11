# Test Plan — 3. Exercise and muscle-group master data

Task: plans/2026-10-05_2026-10-09/3. Exercise and muscle-group master data/
Feature ID(s): F3  ·  Endpoints under test: `GET /api/exercises`, `GET /api/muscle-groups`
Plus DB-level: M:N unique-pair constraint on `exercise_muscle_groups` (no HTTP route this sprint).
Status: DRAFT — awaiting human approval

## Execution summary (executed 2026-10-10)

- Migration `CreateExerciseCatalogue1791598814087` already applied to the live `everfit` DB
  (`migrations` table confirmed); `exercises`, `muscle_groups`, `exercise_muscle_groups` present with
  the `uq_exercise_muscle_groups_exercise_id_muscle_group_id` unique index and
  `ix_exercise_muscle_groups_muscle_group_id` present. No re-apply needed.
- App booted via `npx nx serve api` on `http://localhost:3000` (global prefix `/api`); DB helper
  (`docs/guidelines/tools/database/postgres`) and `psql` 18.1 reachable against `everfit`.
- Result: **16 / 16 scenarios PASS.** Seed data was removed afterward — DB restored to 0/0/0
  (greenfield). Nothing left behind.

## Preconditions / test data

Seed (inserted in one transaction via `psql`, deterministic ids; removed after the run):

Muscle groups: `QA Chest` (…110001), `QA Back` (…110002), `QA Legs` (…110003), `QA Biceps` (…110004).
Exercises: `QA Bench Press` (…220001), `QA Barbell Squat` (…220002), `QA Deadlift` (…220003),
`QA Bicep Curl` (…220004), `QA Pull Up` (…220005), `QA Treadmill Run` (…220006).
Mappings: Bench→Chest; Squat→Legs; Deadlift→{Back, Legs}; Curl→Biceps; Pull Up→{Back, Biceps};
Treadmill Run→∅ (no mapping — exercises the empty `muscleGroups` array case).

Observed response shapes (exact):
- List → `{ items: T[], limit: number, offset: number, total: number }` (`SearchResult<T>` offset form).
- `ExerciseDto` → `{ id, name, muscleGroups: MuscleGroupDto[] }`; `MuscleGroupDto` → `{ id, name }`.
- Validation error → `400 { "code": "VALIDATION_ISSUE", "issues": [{ "message": "…" }] }`.

## Scenarios

| ID | Title | Precondition / data | Request | Expected result | Actual | Maps to |
|----|-------|---------------------|---------|-----------------|--------|---------|
| T1 | Exercises happy path (default pager) | seed | `GET /api/exercises` | 200; `SearchResult<ExerciseDto>`; 6 items ordered `name ASC`; each item has nested `muscleGroups`; `limit=20, offset=0, total=6` | PASS — order Squat, Bench, Curl, Deadlift, Pull Up, Treadmill; Deadlift & Pull Up show 2 groups | AC: list-exercises; nested muscle groups |
| T2 | Exercises page beyond data → empty (not error) | seed | `GET /api/exercises?offset=100` | 200; `items: []`, `total: 6` | PASS | AC: page beyond → empty; edge |
| T3 | Partial-name filter narrows, keeps full mapping | seed | `GET /api/exercises?name=press` | 200; 1 item (QA Bench Press, case-insensitive); its full `muscleGroups` ([Chest]); `total:1` | PASS | AC: optional partial-name filter |
| T4 | muscleGroupId filter narrows to mapped exercises | seed | `GET /api/exercises?muscleGroupId=…110003` (Legs) | 200; 2 items (Squat, Deadlift); Deadlift still lists **both** Back+Legs (full mapping, not just filtered) | PASS | AC: muscle-group filter matches mapped exercises |
| T4b | muscleGroupId filter single-mapped group | seed | `GET /api/exercises?muscleGroupId=…110001` (Chest) | 200; 1 item (Bench Press) | PASS | AC: muscle-group filter |
| T5a | (neg) invalid `limit=0` | — | `GET /api/exercises?limit=0` | 400 `VALIDATION_ISSUE` ("limit … >= 1") | PASS | edge: invalid pagination → 400 |
| T5b | (neg) invalid `limit=101` | — | `GET /api/exercises?limit=101` | 400 `VALIDATION_ISSUE` ("limit … <= 100") | PASS | edge: invalid pagination → 400 |
| T5c | (neg) invalid `offset=-1` | — | `GET /api/exercises?offset=-1` | 400 `VALIDATION_ISSUE` ("offset … >= 0") | PASS | edge: invalid pagination → 400 |
| T5d | (neg) non-numeric `limit=abc` | — | `GET /api/exercises?limit=abc` | 400 `VALIDATION_ISSUE` ("limit must be a number") | PASS | edge: invalid pagination → 400 |
| T5e | (neg) non-integer `limit=1.5` | — | `GET /api/exercises?limit=1.5` | 400 `VALIDATION_ISSUE` ("limit must be an integer") | PASS | edge: invalid pagination → 400 |
| T7 | (neg) malformed `muscleGroupId` | — | `GET /api/exercises?muscleGroupId=not-a-uuid` | 400 `VALIDATION_ISSUE` ("muscleGroupId must be a valid GUID") | PASS | design: 400 malformed muscleGroupId |
| T8 | Unknown-but-valid `muscleGroupId` → empty | — | `GET /api/exercises?muscleGroupId=9999…9999` | 200; `items: []`, `total: 0` (not 404) | PASS | AC: no matches → empty |
| T13 | Name filter no match → empty | seed | `GET /api/exercises?name=zzzznotexist` | 200; `items: []`, `total: 0` | PASS | AC: no matches → empty |
| T14 | Name filter is trimmed | seed | `GET /api/exercises?name=%20%20curl%20` | 200; 1 item (QA Bicep Curl) — leading/trailing spaces trimmed, case-insensitive | PASS | design: `exerciseNameJoiSchema` trim |
| T15 | Combined name + muscleGroupId (AND) | seed | `GET /api/exercises?name=QA&muscleGroupId=…110002` (Back) | 200; 2 items (Deadlift, Pull Up), each full mapping | PASS | AC: filters |
| T6 | Muscle-groups happy path | seed | `GET /api/muscle-groups` | 200; `SearchResult<MuscleGroupDto>`; 4 items `name ASC`; `limit=20, offset=0, total=4` | PASS — Back, Biceps, Chest, Legs | AC: list-muscle-groups |
| T9 | Muscle-groups page beyond data → empty | seed | `GET /api/muscle-groups?offset=50` | 200; `items: []`, `total: 4` | PASS | AC: page beyond → empty |
| T10a | (neg) muscle-groups invalid `limit=0` | — | `GET /api/muscle-groups?limit=0` | 400 `VALIDATION_ISSUE` | PASS | edge: invalid pagination → 400 |
| T10b | (neg) muscle-groups invalid `offset=-5` | — | `GET /api/muscle-groups?offset=-5` | 400 `VALIDATION_ISSUE` | PASS | edge: invalid pagination → 400 |
| T11 | Muscle-groups offset paging is stable/disjoint | seed | `GET /api/muscle-groups?limit=2&offset=0` then `?limit=2&offset=2` | 200; page1 [Back, Biceps], page2 [Chest, Legs]; disjoint, deterministic | PASS | AC: stable ordering, offset |
| T12 | (neg) Duplicate (exercise, muscle_group) pair rejected | seed (Bench→Chest exists) | DB insert of same pair (no HTTP route) | Postgres `23505` on `uq_exercise_muscle_groups_exercise_id_muscle_group_id`; row count unchanged. Service translates to **409 `EXERCISE_MUSCLE_GROUP_ALREADY_EXISTS`** | PASS — 23505 raised, 7→7 rows | AC/edge: duplicate pair rejected, unique |

Note on T12: duplicate-mapping protection has no write endpoint this sprint (confirmed in the design);
it is enforced by the DB unique index + the service's `23505`→`ExerciseMuscleGroupAlreadyExistsException`
translation (`exercise.service.ts`), exercised here at the DB boundary and by the seed path (Task 9).

## Coverage check

- Endpoints in this task: `GET /api/exercises` (T1–T5, T7, T8, T13–T15) and `GET /api/muscle-groups`
  (T6, T9, T10, T11) — both covered.
- Error responses in the design: `400 VALIDATION_ISSUE` (pagination + malformed muscleGroupId) — T5*,
  T7, T10*; `409 EXERCISE_MUSCLE_GROUP_ALREADY_EXISTS` (DB-enforced, no route) — T12. No HTTP 404/other
  error paths in this task's surface.
- Acceptance criteria covered: offset-paginated list-exercises with stable ordering + nested muscle
  groups (T1), partial-name filter (T3, T13, T14), muscle-group filter matches mapped exercises (T4,
  T4b, T15), offset-paginated list-muscle-groups with stable ordering (T6, T11), empty/beyond-page →
  empty not error (T2, T8, T9, T13), unique (exercise, muscle group) pair (T12).
- Edge cases covered: invalid pagination → 400 (T5*, T10*); page beyond data → empty (T2, T9);
  deterministic ordering (T1, T6, T11); duplicate mapping rejected not duplicated (T12).

## Cleanup

All `QA *` seed rows deleted after the run (exercise_muscle_groups, exercises, muscle_groups → 0/0/0).
The DB is back to its pre-test greenfield state; no fixtures left behind.
