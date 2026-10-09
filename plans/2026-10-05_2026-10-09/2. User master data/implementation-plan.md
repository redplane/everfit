# Implementation Plan — Task 2: User master data & existence validation (F2)

Phase 1 (PLAN ONLY). No production code written yet. Awaiting human approval of this plan
**and** of the two flagged prerequisites + the database-diagram creation request (see
§6 and §7) before any implementation.

Grounded in: `description.txt` (WHAT, incl. the human-approved read-only list-users discovery),
`architecture-design.md` (the confirmed contract — marked **ready**), `architecture.md`
(§2.1, §4, §5, §9), the Task 1 foundation under `apps/api/src/common/`, and
`docs/guidelines/**`.

All paths below are relative to the Nx workspace; the app root is `apps/api/`.

---

## 1. Branch & PR plan (stacked — Task 2 Depends on Task 1)

- Task 1 PR (#2, branch `feat/1-platform-foundation`, base `main`) is **ready but unmerged** →
  Task 2 is **stacked** on it.
- **Branch:** `feat/2-user-master-data`, created **off** `feat/1-platform-foundation` (NOT `main`).
- **PR base:** `feat/1-platform-foundation` (so the diff shows only Task 2's changes).
- **PR:** opened as a **draft** (`gh pr create --draft`), title
  **`Task 2 — User master data & existence validation (F2)`**.
- Body: summary, test cases covered, DB-diagram note, link to this task folder, Claude attribution.
  Left as a draft pending `reviewer` then (API task) `qa` test-plan sign-off. I do **not** mark it
  ready.

---

## 2. Files to create

### Core module — `apps/api/src/modules/cores/user/`

| File | Declaration | Notes |
| ---- | ----------- | ----- |
| `entities/user.entity.ts` | `UserEntity implements IMutableEntity` | `@Entity({ name: 'users' })`; `id` uuid `@PrimaryColumn` (`pk_users`), `name` `varchar(200)` not null, `created_time` `timestamptz`, `updated_time` `timestamptz` nullable. Constructor `(id, createdTime)` per `typeorm.md` §1. |
| `exceptions/user-by-id-not-found.exception.ts` | `UserByIdNotFoundException extends BusinessException` | `super(BusinessExceptionCodes.USER_NOT_FOUND, message, HttpStatus.NOT_FOUND)`. Message includes the id. (`USER_NOT_FOUND` already in `business-exception-codes.ts`.) |
| `services/user/user-service.interface.ts` | `IUserService` | `getByIdAsync(id): Promise<UserEntity>` (throws `UserByIdNotFoundException` if absent); `existsByIdAsync(id): Promise<boolean>`; `searchAsync(criteria: UserSearchCriteria): Promise<SearchResult<UserEntity>>` (offset, stable order `name ASC, id ASC`); `createAsync(options: CreateUserOptions): Promise<UserEntity>`. |
| `services/user/user.service.ts` | `UserService implements IUserService` | `@Injectable()`. Injects `@InjectRepository(UserEntity)` repo + `@Inject(CONTEXT__TIME) ITimeContext`. `createAsync` generates a **UUID v7** id (see §6.1) and stamps `createdTime` from `getUtcNowAsync()`. `searchAsync` uses `findAndCount` with `order: { name: 'ASC', id: 'ASC' }`, `take: limit`, `skip: offset`, returns `{ items, limit, offset, total }`. `getByIdAsync` throws when `findOneBy` returns null. |
| `services/user/user-injection-tokens.ts` | `enum UserServiceInjectionTokens { SERVICE__USER = 'SERVICE__USER' }` | per `service.md` §4. |
| `services/user/user.service.module.ts` | `UserServiceModule` | provides `{ provide: SERVICE__USER, useClass: UserService }`, imports `TypeOrmModule.forFeature([UserEntity])`, exports the token. (File name per architecture-design.md §Contract line 56.) |
| `user.module.ts` | `UserModule` | imports `UserServiceModule`; re-exports `SERVICE__USER` so downstream F5–F8 can consume it. |

### Shared models — `apps/api/src/models/`

| File | Declaration | Notes |
| ---- | ----------- | ----- |
| `options/create-user-options.ts` | `interface CreateUserOptions { name: string }` | per `api.md` §3.5 (`Create<Entity>Options` under `src/models/options/`). Consumed by the seed CLI (Task 9). |
| `criteria/user-search-criteria.ts` | `interface UserSearchCriteria { limit: number; offset: number }` | per architecture-design.md §Contract. |

### Shared reusable Joi schema — `apps/api/src/common/schemas/`

| File | Declaration | Notes |
| ---- | ----------- | ----- |
| `user-id.joi-schema.ts` | `export const userIdJoiSchema = Joi.string().uuid()` | reusable; consumed here and by every read feature (F5–F8). `.required()` applied at the DTO composition site. |

### API module — `apps/api/src/modules/apis/user/`

| File | Declaration | Notes |
| ---- | ----------- | ----- |
| `user-api.module.ts` | `UserApiModule` | imports `UserModule` + `JoiServiceModule`; declares `UserApiController`. No providers of its own (thin). |
| `user-api.controller.ts` | `UserApiController` | `@Controller({ path: 'api/users' })`, `@ApiTags('Users')`. Injects `SERVICE__JOI` (`IJoiService`) + `SERVICE__USER` (`IUserService`). Two handlers (§3). |
| `dto/get-users-query.dto.ts` | `GetUsersQueryDto { limit: number; offset: number }` | query DTO. |
| `dto/get-users-query.joi-schema.ts` | `getUsersQueryJoiSchema` | `Joi.object<GetUsersQueryDto>(...)` composed from `offsetPagerJoiSchema` (`limit` 1..100 default 20, `offset` ≥0 default 0) — reuse, not re-declare. |
| `dto/get-user-param.dto.ts` | `GetUserParamDto { id: string }` | route-param DTO. |
| `dto/get-user-param.joi-schema.ts` | `getUserParamJoiSchema` | `Joi.object<GetUserParamDto>({ id: userIdJoiSchema.required() })`. |
| `dto/user.dto.ts` | `UserDto { id; name; createdTime }` + `static fromEntity(e): UserDto` | response DTO + mapper; `@ApiProperty` annotations. |

### Migration — `apps/api/src/migrations/`

| File | Declaration | Notes |
| ---- | ----------- | ----- |
| `<timestamp>-CreateUsers.ts` | `CreateUsers implements MigrationInterface` | see §4. CLI-generated `{timestamp}-CreateUsers.ts` naming (`typeorm.md` §4). |

---

## 3. Controller handlers (`UserApiController`) — request-flow order

Both follow the mandatory flow (validate → [no generic checks] → domain check → db) from
`request-flow.md`; controller stays thin, no DB access, no `try/catch`.

- **`searchAsync` — `GET /api/users`**, `@HttpCode(200)`, `@ApiOperation({ summary: 'List users' })`.
  1. Validate query via `joiService.validateAsync(query, getUsersQueryJoiSchema)` → coerced
     `{ limit, offset }` (defaults applied).
  2. `const result = await userService.searchAsync({ limit, offset })`.
  3. Map → `SearchResult<UserDto>`: `{ items: result.items.map(UserDto.fromEntity), limit, offset, total }`.
  - Empty / beyond-page → service returns empty `items` with correct `total` → **200 empty**, not an error.

- **`getAsync` — `GET /api/users/:id`**, `@HttpCode(200)`,
  `@ApiOperation({ summary: 'Get a user by id' })`.
  1. Validate param via `joiService.validateAsync({ id }, getUserParamJoiSchema)`.
  2. Domain/db: `const user = await userService.getByIdAsync(id)` — throws
     `UserByIdNotFoundException` (→ 404 `USER_NOT_FOUND`) when absent.
  3. Return `UserDto.fromEntity(user)`.

## 3.1 Wiring change (only existing file touched)

- `apps/api/src/app/app.module.ts` — add `UserApiModule` to `imports`. (No existing test for
  `app.module.ts`; `app.controller.spec.ts` / `app.service.spec.ts` are unaffected.)

---

## 4. Migration — `CreateUsers`

Consistent with `architecture.md` §2.1 and the entity. Uses `QueryRunner.createTable` with
explicit names (`typeorm.md` §3).

- **`up()`** — create table `users`:
  - `id` `uuid` **PK**, constraint `pk_users` (value supplied by the app as UUID v7 — no DB default).
  - `name` `varchar(200)` `NOT NULL`.
  - `created_time` `timestamptz` `NOT NULL`.
  - `updated_time` `timestamptz` `NULL`.
  - No extra indexes (lookups are by PK).
- **`down()`** — `DROP TABLE users` (cleanly reverses `up()`).

Migration up/down will be verified against the live `everfit-postgres` container during
implementation (`typeorm migration:run` / `migration:revert` via `src/data-source.ts`).

---

## 5. Test cases to be covered (new files only)

Unit-testing rules honored: one `describe` per function in one file; every branch; exact exception
type; in-memory DB for persistence; branch coverage ≥ 80%.

### 5.1 `apps/api/src/modules/cores/user/services/user/user.service.spec.ts`

In-memory DB (see §6.2) + a fake `ITimeContext` returning a fixed instant.

- **`describe('createAsync')`**
  - persists a user and returns it with a generated UUID v7 `id`, the given `name`, `createdTime`
    equal to the fake clock, and `updatedTime` undefined.
- **`describe('getByIdAsync')`**
  - returns the entity when present (found branch).
  - throws **`UserByIdNotFoundException`** (exact type) when absent (not-found branch).
- **`describe('existsByIdAsync')`**
  - returns `true` when the user exists (true branch).
  - returns `false` when the user does not exist (false branch).
- **`describe('searchAsync')`**
  - returns items ordered by `name ASC, id ASC` with `total` = full count (seed several users).
  - tie-break: equal names ordered by `id ASC` (deterministic ordering across pages).
  - respects `limit` (returns at most `limit` items; `total` is the full count).
  - respects `offset` (returns the correct slice; echoes `limit`/`offset`).
  - page beyond the data → empty `items`, `total` reflects full count — **not an error**.
  - empty table → empty `items`, `total` 0 — **not an error**.

### 5.2 `apps/api/src/modules/apis/user/user-api.controller.spec.ts`

Real `JoiService` (to drive the validation branches) + a stub `IUserService` bound to
`SERVICE__USER`.

- **`describe('getAsync')`**
  - validates the param and returns a `UserDto` for an existing user (maps id/name/createdTime).
  - propagates **`UserByIdNotFoundException`** when the service throws (unknown user → 404).
  - malformed, non-uuid `id` → **`ValidationException`** (400) — nothing past validation runs.
- **`describe('searchAsync')`**
  - returns `SearchResult<UserDto>` mapping each entity via `UserDto.fromEntity`.
  - applies default pager (`limit` 20, `offset` 0) when both are omitted.
  - invalid pagination `limit > 100` → **`ValidationException`** (400).
  - invalid pagination negative `offset` → **`ValidationException`** (400).
  - invalid pagination non-integer `limit` → **`ValidationException`** (400).
  - empty / beyond-page: when the service returns empty `items`, returns a 200 `SearchResult`
    with empty `items` (echoing `total`) — not an error.

### 5.3 Existing tests touched

- **None.** (Matches architecture-design.md "Existing tests that must change: None → ready".)
  The scaffolded `app.controller.spec.ts` / `app.service.spec.ts` are unaffected.

---

## 6. Flagged prerequisites (need approval — not in Task 1, not explicitly provisioned)

These are required to implement the confirmed contract but are not yet present in the workspace.
I am surfacing them rather than silently introducing them.

### 6.1 UUID v7 generator (new runtime dependency)

- The architecture mandates **UUID v7** primary keys, generated at write time. The only `uuid`
  in the tree is a **transitive v8.3.2** (no `v7` export); Node's `crypto.randomUUID()` is v4 only.
- **Proposal:** add `uuid@^11` as a direct dependency (ships `v7` + its own types) and call its
  `v7()` inside `UserService.createAsync`. Minimal, standard, keeps ids time-ordered as designed.
- Alternative if a new dependency is undesirable: a tiny in-repo `generateUuidV7()` helper under
  `apps/api/src/common/utils/` — but that edits the shared foundation, so I prefer the dependency.
  **Please confirm the approach.**

### 6.2 In-memory database for unit tests (new dev dependency)

- `unit-testing.md` §3 requires an **in-memory DB** for persistence tests; Task 1's specs were all
  pure (no DB), so no driver is installed (`sqlite3` / `better-sqlite3` / `pg-mem` all absent).
- **Proposal:** add **`pg-mem`** as a `devDependency` and build a TypeORM `DataSource` from it in
  `user.service.spec.ts`. Rationale: pure-JS (no native node-gyp build on Windows), and it mirrors
  Postgres semantics (uuid, `timestamptz`, `ORDER BY`) far more faithfully than sqlite — so the
  ordering/pagination assertions actually reflect production behavior.
- Alternative: `better-sqlite3` (needs a native build toolchain on Windows). **Please confirm.**

If neither §6.1 nor §6.2 is approved, I will stop and re-plan rather than improvise.

---

## 7. Database diagram — creation request (approval required)

- This is the **first task that creates a table**, and `docs/designs/database-diagram.txt`
  **does not exist** (only the empty `docs/designs/` folder is present).
- Per my role I must **not** create it silently. **Requesting human approval** to create
  `docs/designs/database-diagram.txt` as part of this task, in **dbdiagram.io DBML** syntax,
  containing the schema actually shipped so far — the `users` table — mirroring `architecture.md`
  §2.1 and the ER diagram:

  ```dbml
  Table users {
    id uuid [pk, note: 'v7']
    name varchar(200) [not null]
    created_time timestamptz [not null]
    updated_time timestamptz [null]
  }
  ```

  (It grows per subsequent task as their tables land; it must always match the live
  entities/migrations.) **Please approve creating this file.**

---

## 8. Environment variables

- **None.** (architecture-design.md §Environment variables = None.) No `README.md` /
  `.env.api` / `.env.api.example` changes in this task.

---

## 9. Verification (implementation phase, after approval)

- `pnpm nx test api` (with coverage) — green, branch coverage ≥ 80%.
- `pnpm nx build api` — compiles.
- `pnpm nx lint api` — clean for introduced code.
- Migration `up()`/`down()` verified against the `everfit-postgres` container.
- Done-when (architecture-design.md): unknown-user read → 404 `USER_NOT_FOUND`; known-user-no-data
  distinction preserved for downstream reads; conventions met.

---

## 10. Summary

- **Create:** 7 core-module files, 2 shared models, 1 shared Joi schema, 7 API-module files,
  1 migration. **Change:** `app.module.ts` (register `UserApiModule`).
- **DB impact:** yes — new `users` table (+ migration) and a **new** `docs/designs/database-diagram.txt`
  (pending approval, §7).
- **New env vars:** none.
- **Flagged for approval:** UUID v7 dependency (§6.1), in-memory test DB dependency (§6.2),
  database-diagram creation (§7).
- **Existing tests changed:** none.
- **Stacked PR:** branch `feat/2-user-master-data` off `feat/1-platform-foundation`,
  base `feat/1-platform-foundation`, opened as a **draft**.
