# Implementation Plan — Task 3: Exercise & muscle-group master data + mapping

- **Task:** `3. Exercise and muscle-group master data` — Feature **F3**.
- **Phase:** PLAN ONLY (no production code yet). Awaiting human approval before Phase 2.
- **Depends on:** Task 1 (Platform foundation) only. Independent of Tasks 2 and 4.
- **Design status:** `architecture-design.md` is confirmed (no BLOCKED marker; existing-tests-to-change = None → ready).

This plan implements the confirmed contract in `architecture-design.md` and `architecture.md`
§2.2–2.4, §3, §5, §6, §9. It reuses the Task 1 foundation (time context, `JoiService`,
`SearchResult`/`OffsetPager` models + `offsetPagerJoiSchema`, config, data-source/migrations) and
follows the module patterns Task 2 established — without importing any Task 2 code.

---

## 0. Decisions / flags needing a human answer BEFORE Phase 2

1. **DB diagram does not exist on the Task 1 branch (stacking reality).**
   `docs/designs/database-diagram.txt` was created in **Task 2** on branch `feat/2-user-master-data`.
   Task 3 **stacks on `feat/1-platform-foundation`** (not Task 2), where that file does **not** exist —
   and the `users` table it documents is also absent on this branch. Per my standing rule I must not
   create `database-diagram.txt` silently.
   - **Requested approval:** let me **create** `docs/designs/database-diagram.txt` on the Task 3
     branch containing the schema actually present on this branch — i.e. the **three Task 3 tables**
     (`exercises`, `muscle_groups`, `exercise_muscle_groups`) plus the M:N relationship — with a
     header noting it is branch-scoped and will reconcile with the `users` table once Task 1/Task 2
     merge to `main`. (Alternative: skip the diagram on this branch and update it post-merge. I
     recommend creating it now so the diagram ships with the schema change, matching the standing
     policy.)
   - No other decision changes if you prefer the alternative; say which you want.

2. **No new dependencies required.** `pg-mem`, `uuid`, `joi`, `@nestjs/swagger`, `@nestjs/typeorm`
   are all already present. No new environment variables (architecture-design §Environment variables
   = None), so **no README / `.env.api` changes**.

Everything below assumes approval of (1) option A (create the branch-scoped diagram).

---

## 1. Branch / PR plan

- **Branch:** `feat/3-exercise-master-data`, created **off `feat/1-platform-foundation`** (stacked).
- **PR base:** `feat/1-platform-foundation` (NOT `main`), so the diff shows only Task 3's changes.
- **PR:** opened as a **draft** (`gh pr create --draft`), title:
  `feat(exercise): Task 3 — exercise & muscle-group master data + mapping (F3)`.
- Body: summary, test cases covered, DB-diagram note, link to this task folder, Claude attribution.
- Not marked ready by me — pending `reviewer` then `qa` sign-off.

---

## 2. Changes — files to create/change

### 2.1 Core module `src/modules/cores/exercise/`

**Entities** (`entities/`) — TypeORM, `Entity`-suffixed, `IMutableEntity`, named PK/constraints,
`timestamptz`, app-supplied UUID v7 id (match `UserEntity` idioms):

- `entities/exercise.entity.ts` — `ExerciseEntity` → table `exercises`.
  - `id` uuid PK `pk_exercises`; `name` `varchar(200)` with unique index `uq_exercises_name`;
    `created_time`; `updated_time?`.
  - `@OneToMany(() => ExerciseMuscleGroupEntity, m => m.exercise)` `exerciseMuscleGroups` relation
    (inverse side) so `searchAsync` can eager-load mapped muscle groups.
- `entities/muscle-group.entity.ts` — `MuscleGroupEntity` → table `muscle_groups`.
  - `id` uuid PK `pk_muscle_groups`; `name` `varchar(200)` unique `uq_muscle_groups_name`;
    `created_time`; `updated_time?`.
- `entities/exercise-muscle-group.entity.ts` — `ExerciseMuscleGroupEntity` → table
  `exercise_muscle_groups`.
  - `id` uuid PK `pk_exercise_muscle_groups`; `exercise_id` uuid FK; `muscle_group_id` uuid FK;
    `created_time`; `updated_time?`.
  - `@ManyToOne` to `ExerciseEntity` (`exercise`) and to `MuscleGroupEntity` (`muscleGroup`), each
    `@JoinColumn` with the named FK constraint (`fk_exercise_muscle_groups_exercise_id`,
    `fk_exercise_muscle_groups_muscle_group_id`).
  - `@Unique('uq_exercise_muscle_groups_exercise_id_muscle_group_id', ['exerciseId','muscleGroupId'])`.
  - `@Index('ix_exercise_muscle_groups_muscle_group_id', ['muscleGroupId','exerciseId'])`.

**Exceptions** (`exceptions/`) — `BusinessException` subclasses (match `UserByIdNotFoundException`):

- `exceptions/exercise-by-id-not-found.exception.ts` — `ExerciseByIdNotFoundException`
  (`EXERCISE_NOT_FOUND`, 404).
- `exceptions/muscle-group-by-id-not-found.exception.ts` — `MuscleGroupByIdNotFoundException`
  (`MUSCLE_GROUP_NOT_FOUND`, 404).
- `exceptions/exercise-muscle-group-already-exists.exception.ts` —
  `ExerciseMuscleGroupAlreadyExistsException` (`EXERCISE_MUSCLE_GROUP_ALREADY_EXISTS`, 409).

**Constants change** — `src/common/constants/business-exception-codes.ts`: add
`EXERCISE_NOT_FOUND`, `MUSCLE_GROUP_NOT_FOUND`, `EXERCISE_MUSCLE_GROUP_ALREADY_EXISTS`
(the enum already exists from Task 1; these members are additive). *This is the only common-file edit.*

**Exercise service** (`services/exercise/`) — interface-first + token enum + provider module:

- `services/exercise/exercise-injection-tokens.ts` — enum
  `ExerciseServiceInjectionTokens { SERVICE__EXERCISE = 'SERVICE__EXERCISE' }`.
- `services/exercise/exercise-service.interface.ts` — `IExerciseService`:
  - `getByIdAsync(id)` → throws `ExerciseByIdNotFoundException` when missing.
  - `existsByIdAsync(id): Promise<boolean>` (for F5).
  - `searchAsync(criteria: ExerciseSearchCriteria): Promise<SearchResult<ExerciseEntity>>` —
    offset; optional partial `name` filter (ILIKE) and optional `muscleGroupId` filter;
    eager-loads mapped muscle groups via the relation; order `name ASC, id ASC`.
  - `resolveIdsByNameLikeAsync(term): Promise<string[]>` (for F6).
  - `resolveIdsByMuscleGroupIdAsync(muscleGroupId): Promise<string[]>` (for F6).
  - `createAsync(options: CreateExerciseOptions): Promise<ExerciseEntity>` (for seed/Task 9).
  - `mapMuscleGroupAsync(exerciseId, muscleGroupId): Promise<ExerciseMuscleGroupEntity>` — throws
    `ExerciseMuscleGroupAlreadyExistsException`, translating Postgres `23505` (for seed/Task 9).
- `services/exercise/exercise.service.ts` — `ExerciseService implements IExerciseService`.
  Injects `@InjectRepository(ExerciseEntity)`, `@InjectRepository(ExerciseMuscleGroupEntity)`, and
  `@Inject(CONTEXT__TIME) ITimeContext`. `searchAsync` uses a QueryBuilder (or `findAndCount` with
  `relations`) joining `exerciseMuscleGroups.muscleGroup`, applying `name ILIKE :term` and the
  `muscleGroupId` sub-filter when present, `ORDER BY name ASC, id ASC`, `take`/`skip`.
  `mapMuscleGroupAsync` catches the driver error and rethrows the 409 when `code === '23505'`.
- `services/exercise/exercise.service.module.ts` — `ExerciseServiceModule`: `TypeOrmModule.forFeature`
  of the three entities + `TimeContextModule`; provides `SERVICE__EXERCISE` via `useClass`; exports it.

**Muscle-group service** (`services/muscle-group/`):

- `services/muscle-group/muscle-group-injection-tokens.ts` — enum
  `MuscleGroupServiceInjectionTokens { SERVICE__MUSCLE_GROUP = 'SERVICE__MUSCLE_GROUP' }`.
- `services/muscle-group/muscle-group-service.interface.ts` — `IMuscleGroupService`:
  `getByIdAsync` (throws `MuscleGroupByIdNotFoundException`), `existsByIdAsync`,
  `searchAsync(criteria: MuscleGroupSearchCriteria): Promise<SearchResult<MuscleGroupEntity>>`
  (offset, order `name ASC, id ASC`), `createAsync(options: CreateMuscleGroupOptions)`.
- `services/muscle-group/muscle-group.service.ts` — `MuscleGroupService` (repo + time context).
- `services/muscle-group/muscle-group.service.module.ts` — `MuscleGroupServiceModule`:
  `forFeature([MuscleGroupEntity])` + `TimeContextModule`; provides/exports `SERVICE__MUSCLE_GROUP`.

**Core aggregate module:**

- `exercise.module.ts` — `ExerciseModule`: `imports: [ExerciseServiceModule, MuscleGroupServiceModule]`,
  `exports: [ExerciseServiceModule, MuscleGroupServiceModule]` (re-export the provider modules, as
  `UserModule` does, so downstream can inject both tokens).

### 2.2 Shared models (`src/models/`)

- `src/models/options/create-exercise-options.ts` — `CreateExerciseOptions { name: string }`.
- `src/models/options/create-muscle-group-options.ts` — `CreateMuscleGroupOptions { name: string }`.
- `src/models/criteria/exercise-search-criteria.ts` —
  `ExerciseSearchCriteria { limit; offset; name?: string; muscleGroupId?: string }`.
- `src/models/criteria/muscle-group-search-criteria.ts` —
  `MuscleGroupSearchCriteria { limit; offset }`.

### 2.3 Shared Joi schema (`src/common/schemas/`)

- `src/common/schemas/exercise-name.joi-schema.ts` — `exerciseNameJoiSchema =
  Joi.string().trim().min(1).max(200)` (reused by the exercises query `name` filter and, later, seed).

### 2.4 API module `src/modules/apis/exercise/`

- `exercise-api.controller.ts` — `ExerciseApiController`, `@ApiTags('Exercises')`,
  `@Controller({ path: 'exercises' })` (**no `api` prefix in the path** — global prefix is in
  `main.ts`; resolves to `/api/exercises`). `@Get()` `searchAsync` → validate `GetExercisesQueryDto`
  via `JoiService` → call `IExerciseService.searchAsync` → map to `SearchResult<ExerciseDto>`.
  Thin controller, follows the request-flow order (validate → service → map).
- `dto/get-exercises-query.dto.ts` — `GetExercisesQueryDto { limit; offset; name?; muscleGroupId? }`
  with `@ApiPropertyOptional` docs.
- `dto/get-exercises-query.joi-schema.ts` —
  `offsetPagerJoiSchema.append({ name: exerciseNameJoiSchema.optional(), muscleGroupId:
  Joi.string().uuid().optional() })` typed as `Joi.ObjectSchema<GetExercisesQueryDto>`.
- `dto/exercise.dto.ts` — `ExerciseDto { id; name; muscleGroups: MuscleGroupDto[] }` +
  `static fromEntity(entity)` mapping the eager-loaded relation to `MuscleGroupDto[]`.
- `exercise-api.module.ts` — `ExerciseApiModule`: `imports: [ExerciseModule, JoiServiceModule]`,
  `controllers: [ExerciseApiController]`.

### 2.5 API module `src/modules/apis/muscle-group/`

- `muscle-group-api.controller.ts` — `MuscleGroupApiController`, `@ApiTags('Muscle groups')`,
  `@Controller({ path: 'muscle-groups' })` → `/api/muscle-groups`. `@Get()` `searchAsync` → validate
  `GetMuscleGroupsQueryDto` → `IMuscleGroupService.searchAsync` → `SearchResult<MuscleGroupDto>`.
- `dto/get-muscle-groups-query.dto.ts` — `GetMuscleGroupsQueryDto { limit; offset }`.
- `dto/get-muscle-groups-query.joi-schema.ts` — `offsetPagerJoiSchema as
  Joi.ObjectSchema<GetMuscleGroupsQueryDto>` (pattern from Task 2's users query).
- `dto/muscle-group.dto.ts` — `MuscleGroupDto { id; name }` + `static fromEntity`. (Shared by the
  exercises response too; lives under the muscle-group api module and is imported by `exercise.dto.ts`.)
- `muscle-group-api.module.ts` — `MuscleGroupApiModule`: `imports: [ExerciseModule, JoiServiceModule]`
  (ExerciseModule exports `SERVICE__MUSCLE_GROUP`), `controllers: [MuscleGroupApiController]`.

### 2.6 Migration (`src/migrations/`)

- `src/migrations/<timestamp>-CreateExerciseCatalogue.ts` — `CreateExerciseCatalogue<ts>`
  (Table-based, matching `CreateUsers`), creating all three tables in FK-safe order with a reversing
  `down()`:
  - `exercises` (PK `pk_exercises`; unique index `uq_exercises_name` on `name`).
  - `muscle_groups` (PK `pk_muscle_groups`; unique index `uq_muscle_groups_name` on `name`).
  - `exercise_muscle_groups` (PK `pk_exercise_muscle_groups`; FKs
    `fk_exercise_muscle_groups_exercise_id` → `exercises(id)` and
    `fk_exercise_muscle_groups_muscle_group_id` → `muscle_groups(id)`; unique constraint
    `uq_exercise_muscle_groups_exercise_id_muscle_group_id` on `(exercise_id, muscle_group_id)`;
    index `ix_exercise_muscle_groups_muscle_group_id` on `(muscle_group_id, exercise_id)`).
  - `down()` drops `exercise_muscle_groups`, then `muscle_groups`, then `exercises`.
  - Migration up/down verified locally against the running `everfit-postgres` container before PR.

### 2.7 App wiring (`src/app/app.module.ts`)

- Register `ExerciseApiModule` and `MuscleGroupApiModule` in `AppModule.imports`
  (alongside the existing modules). `autoLoadEntities: true` picks up the three new entities.

---

## 3. DBML diagram update (`docs/designs/database-diagram.txt`)

Pending decision (0.1). On approval, add the three tables mirroring `architecture.md` §2.2–2.4/§2.8:

```dbml
Table exercises {
  id uuid [pk, note: 'UUID v7, pk_exercises; supplied by the application']
  name varchar(200) [not null, unique, note: 'uq_exercises_name']
  created_time timestamptz [not null]
  updated_time timestamptz [null]
  Note: 'Exercise catalogue master data (F3), read-only discovery this sprint.'
}

Table muscle_groups {
  id uuid [pk, note: 'UUID v7, pk_muscle_groups']
  name varchar(200) [not null, unique, note: 'uq_muscle_groups_name']
  created_time timestamptz [not null]
  updated_time timestamptz [null]
  Note: 'Muscle-group master data (F3).'
}

Table exercise_muscle_groups {
  id uuid [pk, note: 'pk_exercise_muscle_groups']
  exercise_id uuid [not null]
  muscle_group_id uuid [not null]
  created_time timestamptz [not null]
  updated_time timestamptz [null]
  Indexes {
    (exercise_id, muscle_group_id) [unique, name: 'uq_exercise_muscle_groups_exercise_id_muscle_group_id']
    (muscle_group_id, exercise_id) [name: 'ix_exercise_muscle_groups_muscle_group_id']
  }
  Note: 'Configurable M:N exercise<->muscle-group mapping (F3); duplicate pair rejected.'
}

Ref: exercise_muscle_groups.exercise_id > exercises.id      // fk_exercise_muscle_groups_exercise_id
Ref: exercise_muscle_groups.muscle_group_id > muscle_groups.id // fk_exercise_muscle_groups_muscle_group_id
```

---

## 4. Test cases (in-memory pg-mem DB; every branch; exact exception types; ≥80% branch coverage)

pg-mem schema for each spec is raw DDL mirroring the migration (as Task 2 does — `synchronize()` is
avoided). A `FakeTimeContext` fixed clock drives `createAsync` timestamps.

### 4.1 `src/modules/cores/exercise/services/exercise/exercise.service.spec.ts`

- **`createAsync`**: persists with generated UUID v7 id + name + clock `createdTime`; `updatedTime`
  null after insert; row re-read from repo.
- **`getByIdAsync`**: returns entity when present; throws **`ExerciseByIdNotFoundException`** when absent.
- **`existsByIdAsync`**: true when present; false when absent (both branches).
- **`searchAsync`**:
  - orders by `name ASC` with full `total`; tie-break `id ASC` on equal names.
  - respects `limit` (≤ limit items; `total` = full count); respects `offset` (correct slice).
  - page beyond data → empty `items`, correct `total` (not an error); no data → empty, `total` 0.
  - **partial `name` filter** → only ILIKE matches returned; no-match → empty.
  - **`muscleGroupId` filter** → only exercises mapped to that group; unmapped group → empty.
  - **includes mapped muscle groups**: an exercise with 2 mappings returns
    `items[i].exerciseMuscleGroups`/relation populated with both muscle groups (drives
    `ExerciseDto.muscleGroups`).
- **`resolveIdsByNameLikeAsync`**: returns matching ids (match branch); empty array (no-match branch).
- **`resolveIdsByMuscleGroupIdAsync`**: returns mapped exercise ids (match); empty (no mapping).
- **`mapMuscleGroupAsync`**: success returns the join row; **duplicate `(exercise, muscle_group)`
  pair** → throws **`ExerciseMuscleGroupAlreadyExistsException`** (DB unique `23505` translated) —
  this is the acceptance-criteria "duplicate pair rejected" case.

### 4.2 `src/modules/cores/exercise/services/muscle-group/muscle-group.service.spec.ts`

- **`createAsync`**: persists with UUID v7 + clock timestamp.
- **`getByIdAsync`**: found; throws **`MuscleGroupByIdNotFoundException`** when absent.
- **`existsByIdAsync`**: true / false branches.
- **`searchAsync`**: name-ASC order + total; tie-break id ASC; limit; offset; beyond-page empty;
  empty-dataset total 0.

### 4.3 `src/modules/apis/exercise/exercise-api.controller.spec.ts`

Real `JoiService` + stub `IExerciseService` (Task 2 pattern).
- `searchAsync` maps entities (with relations) → `SearchResult<ExerciseDto>` incl. nested
  `muscleGroups`; default pager (`{limit:20,offset:0}`) applied when omitted.
- Validation → **`ValidationException`**: `limit` > 100; `offset` < 0; `limit` non-integer;
  malformed `muscleGroupId` (non-uuid); blank `name` rejected by `exerciseNameJoiSchema`.
- Valid optional `name` + `muscleGroupId` are forwarded to the service criteria.
- Empty service result → empty `SearchResult` (not an error).

### 4.4 `src/modules/apis/muscle-group/muscle-group-api.controller.spec.ts`

- `searchAsync` maps → `SearchResult<MuscleGroupDto>`; default pager applied.
- Validation → **`ValidationException`**: `limit` > 100; `offset` < 0; `limit` non-integer.
- Empty service result → empty `SearchResult`.

### 4.5 AppModule bootstrap smoke test — `src/app/app.module.smoke.spec.ts`

**Required (standing policy; Task 2 shipped a wiring/double-prefix bug only this catches).** Compose
the REAL `AppModule` via `Test.createTestingModule({ imports: [AppModule] })`, override the TypeORM
`DataSource` (token `getDataSourceToken()`) with a **pg-mem** instance whose DDL creates all three
Task 3 tables, apply `app.setGlobalPrefix('api')` exactly as `main.ts`, `init()` + `listen(0, ...)`.
Assertions:
- `GET /api/exercises` → **200**, body is a `SearchResult` (`items` array, `limit` 20, `offset` 0,
  `total` 0 on empty DB).
- `GET /api/muscle-groups` → **200**, `SearchResult` shape.
- Negative: `GET /api/api/exercises` and `GET /api/api/muscle-groups` → **404** (double-prefix must
  NOT exist).
- The test must fail on an export/import/DI/path defect.

> Note on the existing Task-1 smoke test: on the `feat/1-platform-foundation` branch there is **no**
> `app.module.smoke.spec.ts` yet (that file is a Task 2 artifact and is absent here), so I create a
> fresh one for Task 3's endpoints — I am **not modifying an existing test**. If, after Task 2 merges
> and this branch is later rebased, a smoke spec already exists, I will extend it (adding the two new
> routes) rather than overwrite — but that would be an append, still not a case change.

### Also before PR

- Boot the app for real (`pnpm nx serve api` against the local Postgres), run the migration, and
  probe `GET /api/exercises` and `GET /api/muscle-groups`; report observed paths/status codes.

---

## 5. Existing tests touched

**None.** The only existing-file edits are additive: `business-exception-codes.ts` (new enum
members) and `app.module.ts` (register two new modules) — neither is a test. No existing test case
is modified or deleted. (`architecture-design.md` confirms "Existing tests that must change: None".)

---

## 6. Database impact

**Yes** — three new tables (`exercises`, `muscle_groups`, `exercise_muscle_groups`), the unique pair
constraint, two FKs, and the muscle-group lookup index. One migration (`CreateExerciseCatalogue`).
DB diagram update pending the decision in §0.1.

---

## 7. Validation before PR

`pnpm nx test api` (green, ≥80% branch coverage) → `pnpm nx build api` (compiles) →
`pnpm nx lint api` (clean) → migration up/down verified → real boot probe of both endpoints. No PR
opened while any is red.

---

## STOP — awaiting human approval of this plan (and the §0.1 diagram decision) before Phase 2.
