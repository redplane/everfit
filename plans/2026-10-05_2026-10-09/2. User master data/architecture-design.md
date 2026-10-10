# Architecture Design — Task 2: User master data & existence validation

- **Task:** `2. User master data` — Feature **F2**.
- **Depends on:** Task 1 (Platform foundation).
- **Goal:** Introduce a minimal `users` master table and a shared user service/exception so reads
  can distinguish an unknown user (404 `USER_NOT_FOUND`) from a known user with no data (empty).

See `architecture.md` §2.1, §4 (core `user`), §5.

## Database changes

- New table **`users`** → `UserEntity` (mutable, `IMutableEntity`): columns `id` (uuid PK, v7,
  `pk_users`), `name` (`varchar(200)`), `created_time` (`timestamptz`), `updated_time`
  (`timestamptz`, nullable).
- Migration: `src/migrations/<ts>-CreateUsers.ts` with working `up()`/`down()` (drops the table).
- No extra indexes beyond the PK (lookups are by id).

## API changes

Read-only discovery endpoints (human-approved 2026-10-09; F2 now includes list-users discovery).
Both under `@ApiTags('Users')`. No create/update/delete this sprint.

- **`GET /api/users`** — list users, offset-paginated (`@ApiOperation({ summary: 'List users' })`).
  New. 200.
  - Query DTO `GetUsersQueryDto` (`get-users-query.dto.ts`): `limit` (int 1..100, default 20),
    `offset` (int ≥0, default 0) — composed from `offsetPagerJoiSchema`.
  - **Stable ordering:** `ORDER BY name ASC, id ASC` (deterministic across pages).
  - 200 → `SearchResult<UserDto>` (`items`, `limit`, `offset`, `total`).
  - No users / page beyond the data → **200 empty** `items` (`total` reflects the count) — not an
    error.
  - 400 `VALIDATION_ISSUE` — invalid pagination params (e.g. `limit > 100`, negative `offset`,
    non-integer).
- **`GET /api/users/:id`** — get one user (`@ApiOperation({ summary: 'Get a user by id' })`). New.
  - Param DTO `GetUserParamDto` (`get-user-param.dto.ts`): `id` (uuid) via `userIdJoiSchema`.
  - 200 → `UserDto`.
  - 404 `UserByIdNotFoundException` → `{ code: "USER_NOT_FOUND", message }`.
  - 400 malformed id → `ValidationException`.

`UserDto` fields: `id`, `name`, `createdTime`.

## Environment variables

None.

## Contract

- Core module `src/modules/cores/user/`:
  - `entities/user.entity.ts` → `UserEntity`.
  - `services/user/user-service.interface.ts` → `IUserService`:
    `getByIdAsync(id): Promise<UserEntity>` (throws `UserByIdNotFoundException` if absent),
    `existsByIdAsync(id): Promise<boolean>`,
    `searchAsync(criteria: UserSearchCriteria): Promise<SearchResult<UserEntity>>` (offset list,
    stable order `name ASC, id ASC`), `createAsync(options: CreateUserOptions): Promise<UserEntity>`
    (used by the seed CLI, Task 9). `UserSearchCriteria` (`src/models/criteria/user-search-criteria.ts`):
    `limit`, `offset`.
  - `services/user/user.service.ts`, `user-injection-tokens.ts`
    (`UserServiceInjectionTokens.SERVICE__USER`), `user.service.module.ts`.
  - `exceptions/user-by-id-not-found.exception.ts` → `UserByIdNotFoundException extends
    BusinessException` (`USER_NOT_FOUND`, 404).
  - `user.module.ts` (`UserModule`): `TypeOrmModule.forFeature([UserEntity])` + user service module;
    exports `SERVICE__USER`.
- `CreateUserOptions` under `src/models/options/create-user-options.ts`.
- API module `src/modules/apis/user/`: `user-api.module.ts`, `user-api.controller.ts`,
  `dto/` (query/param DTOs + schemas), `UserDto`.
- Reusable `src/common/schemas/user-id.joi-schema.ts` (uuid) — consumed here and by every read
  feature (F5–F8).

## Reuse note for downstream tasks

F5–F8 inject `IUserService` via `SERVICE__USER` and call `existsByIdAsync`/`getByIdAsync` in the
**domain-check** stage: unknown user → `UserByIdNotFoundException` (404); known user with no data →
their query returns empty (not an error).

## Tests to define

- `src/modules/cores/user/services/user/user.service.spec.ts` (in-memory DB):
  `describe('getByIdAsync')` — returns entity when present; throws `UserByIdNotFoundException` when
  absent. `describe('existsByIdAsync')` — true/false branches. `describe('searchAsync')` — returns
  ordered page; respects `limit`/`offset`; empty page beyond data → empty `items` with correct
  `total` (not an error). `describe('createAsync')` — persists and returns with id + createdTime from
  the injected time context (fake clock).
- `src/modules/apis/user/user-api.controller.spec.ts`: `describe('getAsync')` — validates param,
  returns `UserDto`, propagates `UserByIdNotFoundException`. `describe('searchAsync')` — returns
  `SearchResult<UserDto>`; default pager applied; invalid pagination → `ValidationException` (400).

## Existing tests that must change

- **None.** → **ready**.

## Files to create/change

Create the core `user/` module tree, the api `user/` module tree (incl. `get-users-query.dto.ts` +
schema and `UserDto`), `create-user-options.ts`, `user-search-criteria.ts`, `user-id.joi-schema.ts`,
and the migration (paths above). Reuses `offsetPagerJoiSchema` / `SearchResult<T>` from Task 1.
Change: register `UserApiModule` in `app.module.ts`.

## Done when

`pnpm nx test api` passes; `pnpm nx build api` succeeds; migration up/down verified; unknown-user
read returns 404 `USER_NOT_FOUND`; conventions met.
