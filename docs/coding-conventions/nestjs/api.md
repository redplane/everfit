# I. Overview

This document adapts the reference Minimal-API conventions to **NestJS**. The architectural
intent is preserved — thin HTTP layer, validation at the boundary, services own data access, a
central exception filter instead of per-handler `try/catch` — but the .NET CQRS/MediatR split is
**not** used. In NestJS we separate features by **modules** instead.

# II. Convention

## 1. Entry point (`apps/api/src/main.ts`)

- Environment is read from `NODE_ENV` (`development`, `production`, …), the equivalent of
  `ASPNETCORE_ENVIRONMENT`.
- Configuration layering (NestJS `ConfigModule`): load `.env`, then `.env.${NODE_ENV}`, and in
  `development` load `.env.local` (git-ignored secrets) **last** — the equivalent of the
  reference's `secret.json` registered after `appsettings`.
- Enable OpenAPI/Swagger **only** when `NODE_ENV === 'development'`.
- Register the global exception filter (see §3.6) in `main.ts` / the root module.

## 2. Module structure

- Features are **not** split by CQRS. Each feature is a **NestJS module** placed under
  `src/modules/<module-name>/` (module name in `kebab-case`, e.g. `src/modules/user/`,
  `src/modules/workout/`).
- A module folder must contain:

  ```
  src/modules/<module-name>/
    ├── <module-name>-api.module.ts          # module registration (API module)
    ├── <module-name>-api.controller.ts       # controller that serves /api endpoints
    ├── <module-name>.controller.ts           # (optional) controller that serves static resources
    ├── dto/                                   # (optional) only for API modules; see note below
    │   ├── <name>-payload.dto.ts              # body  -> XxxPayloadDto
    │   ├── <name>-query.dto.ts                # query -> XxxQueryDto
    │   └── <name>-param.dto.ts                # route params -> XxxParamDto
    └── models/                                # (optional) module-owned models; see note below
        ├── module-initialization-options.ts   # -> ModuleInitializationOptions
        └── database-options.ts                # -> DatabaseOptions
  ```

- The `dto/` folder is **optional**: it exists only when the module serves an **API**
  (i.e. has a `<module-name>-api.controller.ts`). A module that only serves static resources
  has no `dto/` folder.
- The `models/` folder is **optional**: it exists only when the module has its own models.
  Models are mostly classes or interfaces describing the module's options — for example
  `ModuleInitializationOptions`, `DatabaseOptions`. Model files use plain `dash-case` naming
  (no role suffix), e.g. `module-initialization-options.ts`, `database-options.ts`.

- Provide a `Dockerfile` that builds the `api` app (multi-stage: `nx build api` → slim Node
  runtime) plus a `docker-compose.yml` for the API + PostgreSQL. The build must succeed.

### 2.1. Modules

- A module that registers API endpoints is named `<module-name>-api.module.ts`, class
  `<Name>ApiModule` (e.g. `user-api.module.ts` → `UserApiModule`).
- The module declares its controllers and providers (services). It imports `TypeOrmModule`
  feature registration for its entities.

## 3. API coding

### 3.1. Controllers

- Two kinds of controller, distinguished by what they serve:
  - **`<module-name>-api.controller.ts`** (class `<Name>ApiController`) — serves JSON **API**
    endpoints under `/api/...` (e.g. `/api/user`, `/api/user/premium-invitation`). This is the
    default for the assignment's endpoints.
  - **`<module-name>.controller.ts`** (class `<Name>Controller`) — serves **static resources**
    (HTML, JSON files, downloads, etc.), not the JSON API.
- **Route naming uses `dash-case`** (kebab-case). The base is `/api/<module>`; nested segments
  are also dash-case. Examples: `/api/user`, `/api/user/premium-invitation`,
  `/api/workout/workout-history`.
- Controllers are **thin**: map the request into DTOs → call a service → map the result to a
  response DTO. **No** business logic and **no** direct DB access in controllers.
- Every handler follows the strict **request flow** — validate request → generic back-end checks
  → domain business checks → interact with the database. The order is mandatory and is documented
  in **[request-flow.md](./request-flow.md)**.
- Always return `200` on a successful read; `201` for create; `200`/`204` for update/delete as
  appropriate.
- REST shape:
  - **List / search:** `GET /api/<module-plural-or-noun>` with filters in the query string,
    returning a paginated `SearchResult<T>` where `T` is the response DTO.
    e.g. `GET /api/workouts?userId=…&exerciseName=bench&from=…&to=…&cursor=…&limit=20`
  - **Create:** `POST /api/<module>` with a body payload. Bulk create uses the same route with
    an array payload.
  - **Update:** `PUT /api/<module>/:id` with a body payload; updatable fields use an
    `UpdatableProperty<T>` wrapper so "omitted" is distinguishable from "set to null".
  - **Delete:** `DELETE /api/<module>/:id`.
- Controller handler methods are named by action without repeating the entity:
  `createAsync`, `updateAsync`, `deleteByIdAsync`, `getAsync`, `searchAsync`.

### 3.2. Request parameter mapping (DTOs)

- All request inputs are mapped into DTO classes that live in the module's `dto/` folder, **one
  DTO per file**:
  - Body params → class `<Action><Entity>PayloadDto`, file `<name>-payload.dto.ts`
    (e.g. `CreateUserPayloadDto` in `create-user-payload.dto.ts`).
  - Query-string params → class `<Action><Entity>QueryDto`, file `<name>-query.dto.ts`
    (e.g. `GetWorkoutHistoryQueryDto` in `get-workout-history-query.dto.ts`).
  - Route params → class `<Action><Entity>ParamDto`, file `<name>-param.dto.ts`
    (e.g. `DeleteUserParamDto` in `delete-user-param.dto.ts`).
- The DTO class name and the file name must correspond (`XxxPayloadDto` ↔ `xxx-payload.dto.ts`).

### 3.3. Request validation

- **DO NOT** use the validation annotations provided by NestJS / `class-validator`
  (`@IsString()`, `@IsNotEmpty()`, the global `ValidationPipe`, etc.).
- Validate inputs **explicitly** with **Joi**: every DTO has a matching Joi schema, and the
  controller validates the mapped input via the injected `JoiService` at the start of the handler.
- The full request-validation convention — schema files, `JoiService`, `ValidationException`, and
  the `400` filter — is documented in **[request-validation.md](./request-validation.md)**.

### 3.4. Handling logic in controllers

- Controllers map DTOs and delegate to services; services contain the logic.
- Inject dependencies via the constructor (`@Injectable()` providers, `@Inject(TOKEN)` for
  tokens / keyed providers).
- Entity-not-found: throw `<Entity>ByIdNotFoundException` or `<Entity>ByCodeNotFoundException`
  depending on the lookup key. These extend `BusinessException`
  (`src/common/exceptions/business.exception.ts`).
- **DO NOT** `try/catch` in controllers for control flow — the global exception filter (§3.6)
  translates exceptions into HTTP responses.
- Reading a raw file/stream may be handled directly in a `<module-name>.controller.ts`;
  everything else goes through a service.

### 3.5. Services

- Controllers **never** touch the database or external systems directly — a service does.
- A service is an `@Injectable()` class `<Entity>Service`. Expose an interface + token only when
  multiple implementations are needed.
- Standard data-access methods: `getByIdAsync(id)`, `createAsync(options)`,
  `updateByIdAsync(id, options)`, `deleteByIdAsync(id)`.
- `createAsync` / `updateByIdAsync` take an `options` object typed `Create<Entity>Options` /
  `Update<Entity>Options`, declared under `src/models/options/`.
- Data-access services are registered as the default NestJS (singleton) providers; use request
  scope only when genuinely needed. Do not refactor an existing service's scope purely to satisfy
  this rule.
- File access goes through an injected file-system abstraction, **not** Node `fs` statics, so it
  stays testable.
- **DO NOT** use `new Date()` / `Date.now()` directly. Inject a `DateTimeContext` provider and
  call `getUtcNowAsync()` — the equivalent of the reference's `IDateTimeContext`. This keeps time
  deterministic in tests.

### 3.6. Behavior / errors

- Missing data → throw `<Entity>ByIdNotFoundException` / `<Entity>ByCodeNotFoundException`.
- Other domain errors → an `<Name>Exception` extending `BusinessException`, surfaced by the
  global exception filter as a structured error body with a stable application error code (the
  reference uses status `666` for generic business errors; use a documented, consistent
  code/shape here).
- When creating data whose dependency must exist, throw a not-found exception if it is missing.

## 4. Extensibility notes (from `docs/requirement.md`)

- **Unit conversion** (kg/lb and future units like stone) must be an injectable strategy, not a
  hardcoded `if`. Adding a unit = adding one provider/config entry.
- **Exercise → muscle-group mapping** is configuration-driven (config/provider), not hardcoded
  in business logic.
