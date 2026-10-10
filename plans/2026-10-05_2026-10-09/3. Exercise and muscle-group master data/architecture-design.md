# Architecture Design — Task 3: Exercise & muscle-group master data + mapping

- **Task:** `3. Exercise and muscle-group master data` — Feature **F3**.
- **Depends on:** Task 1 (Platform foundation). Independent of Tasks 2 and 4 (parallelizable).
- **Goal:** Managed exercise and muscle-group catalogues with a configurable M:N mapping (unique
  pair), so logs reference real exercises and history can filter by muscle group without hardcoded
  logic.

See `architecture.md` §2.2–2.4, §3 (join index), §4 (core `exercise`), §5, §6.

## Database changes

- **`exercises`** → `ExerciseEntity` (mutable): `id` (uuid PK `pk_exercises`), `name`
  (`varchar(200)`, unique `uq_exercises_name`), `created_time`, `updated_time?`.
- **`muscle_groups`** → `MuscleGroupEntity` (mutable): `id` (uuid PK `pk_muscle_groups`), `name`
  (`varchar(200)`, unique `uq_muscle_groups_name`), `created_time`, `updated_time?`.
- **`exercise_muscle_groups`** → `ExerciseMuscleGroupEntity` (mutable): `id` (uuid PK), `exercise_id`
  (FK `fk_exercise_muscle_groups_exercise_id`), `muscle_group_id` (FK
  `fk_exercise_muscle_groups_muscle_group_id`), `created_time`, `updated_time?`.
  - Unique pair `uq_exercise_muscle_groups_exercise_id_muscle_group_id` (duplicate mapping rejected).
  - Index `ix_exercise_muscle_groups_muscle_group_id` on `(muscle_group_id, exercise_id)` for the
    history muscle-group filter (F6).
- Migration `src/migrations/<ts>-CreateExerciseCatalogue.ts` creating all three tables + constraints
  + indexes, with a reversing `down()`.

## API changes

Read-only list endpoints (human-approved 2026-10-09; F3 now includes list-exercises and
list-muscle-groups discovery). No CRUD UI (F3 out-of-scope); the catalogue is populated by the seed
CLI (Task 9).

- **`GET /api/exercises`** (`@ApiTags('Exercises')`,
  `@ApiOperation({ summary: 'List exercises' })`) — offset list. New. 200.
  - `GetExercisesQueryDto` (`get-exercises-query.dto.ts`): `limit` (int 1..100, def 20), `offset`
    (int ≥0, def 0) via `offsetPagerJoiSchema`; optional `name` (partial, trimmed — via
    `exerciseNameJoiSchema`) and optional `muscleGroupId` (uuid) filters.
  - **Stable ordering:** `ORDER BY name ASC, id ASC`.
  - 200 → `SearchResult<ExerciseDto>`; `ExerciseDto` = `id`, `name`,
    `muscleGroups: MuscleGroupDto[]` (each exercise includes its mapped muscle groups).
  - No matches / page beyond the data → **200 empty** `items` (not an error).
  - 400 `VALIDATION_ISSUE` — invalid pagination params or malformed `muscleGroupId`.
- **`GET /api/muscle-groups`** (`@ApiTags('Muscle groups')`,
  `@ApiOperation({ summary: 'List muscle groups' })`) — offset list. New. 200.
  - `GetMuscleGroupsQueryDto` (`get-muscle-groups-query.dto.ts`): `limit`, `offset` via
    `offsetPagerJoiSchema`.
  - **Stable ordering:** `ORDER BY name ASC, id ASC`.
  - 200 → `SearchResult<MuscleGroupDto>`; `MuscleGroupDto` = `id`, `name`.
  - No muscle groups / page beyond data → **200 empty** `items` (not an error).
  - 400 `VALIDATION_ISSUE` — invalid pagination params.

No write endpoints this sprint. Duplicate-mapping protection (`ExerciseMuscleGroupAlreadyExistsException`
→ 409 `EXERCISE_MUSCLE_GROUP_ALREADY_EXISTS`) is enforced by the service + DB unique constraint and
exercised by the seed path (Task 9), not an HTTP route.

## Environment variables

None.

## Contract

- Core module `src/modules/cores/exercise/`:
  - `entities/exercise.entity.ts`, `muscle-group.entity.ts`, `exercise-muscle-group.entity.ts`.
  - `services/exercise/` → `IExerciseService`:
    `getByIdAsync(id)` (throws `ExerciseByIdNotFoundException`), `existsByIdAsync(id)`,
    `searchAsync(criteria): Promise<SearchResult<ExerciseEntity>>` (offset; optional name/muscleGroup
    filters; **eager-loads mapped muscle groups** via the M:N relation so `ExerciseDto.muscleGroups`
    can be populated; stable order `name ASC, id ASC`),
    `resolveIdsByNameLikeAsync(term): Promise<string[]>` (partial match, for F6),
    `resolveIdsByMuscleGroupIdAsync(muscleGroupId): Promise<string[]>` (for F6),
    `createAsync(options)`, `mapMuscleGroupAsync(exerciseId, muscleGroupId)` (throws
    `ExerciseMuscleGroupAlreadyExistsException` / translates `23505`) — last two for seed.
    Token `ExerciseServiceInjectionTokens.SERVICE__EXERCISE`.
  - `services/muscle-group/` → `IMuscleGroupService`: `getByIdAsync`, `existsByIdAsync`,
    `searchAsync` (offset), `createAsync`. Token `SERVICE__MUSCLE_GROUP`.
  - `exceptions/exercise-by-id-not-found.exception.ts` (404 `EXERCISE_NOT_FOUND`),
    `muscle-group-by-id-not-found.exception.ts` (404 `MUSCLE_GROUP_NOT_FOUND`),
    `exercise-muscle-group-already-exists.exception.ts` (409).
  - `exercise.module.ts` (`ExerciseModule`): `forFeature` the three entities + both service modules;
    exports `SERVICE__EXERCISE`, `SERVICE__MUSCLE_GROUP`.
- Options under `src/models/options/`: `create-exercise-options.ts`,
  `create-muscle-group-options.ts`.
- API modules `src/modules/apis/exercise/` and `src/modules/apis/muscle-group/` (controllers + dto).
- Reusable `src/common/schemas/exercise-name.joi-schema.ts`.

## Reuse note for downstream tasks

F5 uses `existsByIdAsync` to reject logging against a non-existent exercise (404). F6 uses
`resolveIdsByNameLikeAsync` (partial name filter) and `resolveIdsByMuscleGroupIdAsync` (muscle-group
filter). The mapping is relational/configurable — no hardcoded exercise→muscle logic (F3/§6).

## Tests to define (in-memory DB)

- `src/modules/cores/exercise/services/exercise/exercise.service.spec.ts`:
  `getByIdAsync` (found / `ExerciseByIdNotFoundException`), `existsByIdAsync` (true/false),
  `searchAsync` (filters + paging branches), `resolveIdsByNameLikeAsync` (match / no-match),
  `resolveIdsByMuscleGroupIdAsync` (match / empty), `mapMuscleGroupAsync` (success /
  `ExerciseMuscleGroupAlreadyExistsException` on duplicate).
- `src/modules/cores/exercise/services/muscle-group/muscle-group.service.spec.ts`:
  `getByIdAsync` (found / not-found), `existsByIdAsync`, `searchAsync`, `createAsync`.
- `src/modules/apis/exercise/exercise-api.controller.spec.ts` and
  `src/modules/apis/muscle-group/muscle-group-api.controller.spec.ts`: `searchAsync` returns
  `SearchResult<...>`, default pager applied, validation propagates.

## Existing tests that must change

- **None.** → **ready**.

## Files to create/change

Core `exercise/` tree (entities, both service folders, exceptions, module), api `exercise/` and
`muscle-group/` trees, options files, `exercise-name.joi-schema.ts`, the migration. Change:
register both API modules in `app.module.ts`.

## Done when

`pnpm nx test api` passes; `pnpm nx build api` succeeds; migration up/down verified; unique pair
constraint enforced; lists paginate via offset; conventions met.
