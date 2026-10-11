# Implementation Plan — Task 1: Platform foundation

- **Task:** `1. Platform foundation` — Feature **F1**.
- **Depends on:** none (foundational) → branches off `main`.
- **Phase:** PLAN ONLY. No production code written yet; awaiting human approval.
- **Scope source:** `description.txt` (WHAT) + `architecture-design.md` (HOW, confirmed) +
  `architecture.md` §5/§6/§7/§9/§10.

All paths below are rooted at the Nx api app: `apps/api/` (the design's `src/...` shorthand maps to
`apps/api/src/...`). Conventions followed: `service.md`, `time-context.md`, `request-validation.md`,
`error-handling.md`, `api.md`, `orms/typeorm.md`, `best-practices/unit-testing.md`.

---

## 1. Branch & PR plan

- **Branch:** `feat/1-platform-foundation` (off `main` — no dependency).
- **PR title:** `Task 1 — Platform foundation (errors, Joi validation, time context, config, API docs)`.
- **Draft PR** (`gh pr create --draft`), base `main`. Body: summary, test cases covered, DB-diagram
  note (none — see §6), new env vars (§5), task-folder link, Claude Code attribution. Left as a
  **draft** pending `reviewer` + (API tasks) `qa`; I do not mark it ready.

---

## 2. Files to CREATE

### 2.1 Time context (`apps/api/src/common/time-context/`) — per `time-context.md`
- `time-context.interface.ts` — `ITimeContext { getUtcNowAsync(): Promise<Date> }`.
- `time-context.ts` — `@Injectable() TimeContext implements ITimeContext`; the **only** `new Date()`.
- `time-context-injection-tokens.ts` — `enum TimeContextInjectionTokens { CONTEXT__TIME = 'CONTEXT__TIME' }`.
- `time-context.module.ts` — `TimeContextModule` provides via token + exports it.

### 2.2 Joi service (`apps/api/src/common/services/joi/`) — per `request-validation.md`
- `joi-service.interface.ts` — `IJoiService { validateAsync<T>(instance: T, schema: Joi.Schema<T>): Promise<T> }`.
- `joi.service.ts` — `@Injectable() JoiService implements IJoiService`; `convert: true`; maps Joi
  `details[]` → `ValidationIssue[]` → `ValidationException`; re-throws non-Joi errors unchanged.
- `joi-injection-tokens.ts` — `enum JoiServiceInjectionTokens { SERVICE__JOI = 'SERVICE__JOI' }`.
- `joi.module.ts` — `JoiServiceModule` provides via token + exports it.

### 2.3 Common models (`apps/api/src/common/models/`) — per `architecture.md` §9
- `search-result.ts` — `SearchResult<T>` interface: `items: T[]; limit: number; offset?: number;
  total?: number; nextCursor?: string | null`.
- `pager.ts` — pager shapes: `OffsetPager { limit: number; offset: number }` and
  `CursorPager { limit: number; cursor?: string }` (one declaration per file; if `generic.md`'s
  one-decl-per-file rule requires splitting, these become `offset-pager.ts` / `cursor-pager.ts` —
  see §8 open item O3).

### 2.4 Reusable Joi schemas (`apps/api/src/common/schemas/`) — per `request-validation.md` §2
- `offset-pager.joi-schema.ts` — `offsetPagerJoiSchema` = `{ limit: 1..100 default 20, offset: >=0
  default 0 }`.
- `cursor-pager.joi-schema.ts` — `cursorPagerJoiSchema` = `{ limit: 1..100 default 20, cursor:
  string optional }`.

### 2.5 Config (`apps/api/src/common/config/`) — per `architecture.md` §10
- `database.config.ts` — `registerAs('database', …)` reading `DATABASE__HOST/PORT/USERNAME/PASSWORD/
  NAME` (port `?? 5432`).
- `api-document.config.ts` — `registerAs('apiDocument', …)` reading `API_DOCUMENT__ENABLED`
  (default `false`).
- `env-validation.joi-schema.ts` — `envValidationJoiSchema` (a `Joi.object`) passed to
  `ConfigModule.forRoot({ validationSchema })` for **boot-time** env validation. Covers `NODE_ENV`
  (default `development`), `PORT` (default `3000`), the four required `DATABASE__*`, `DATABASE__PORT`
  (default `5432`), `API_DOCUMENT__ENABLED` (bool, default `false`). This is standalone Joi (not the
  request-time `JoiService`).

### 2.6 TypeORM wiring (`apps/api/src/`) — per `typeorm.md`
- `data-source.ts` — TypeORM CLI `DataSource` for migrations: reads env, `synchronize: false`,
  `entities` glob (currently matches nothing — entities arrive in tasks 2/3/5), `migrations:
  ['apps/api/src/migrations/*.ts']`. Bootstrap/CLI config — not unit-tested (§7).
- `migrations/.gitkeep` — empty migrations folder committed (no entities yet → no migration this
  task; the toolchain is wired so a migration can be generated once entities land).

### 2.7 Docker & env example
- `.env.example` — committed example documenting every new variable with sample values
  (see §5 for the naming-convention flag).
- `Dockerfile` — multi-stage: `pnpm nx build api` → slim Node runtime.
- `docker-compose.yml` — **extend existing** (currently postgres-only) to add the `api` service
  (build from Dockerfile, env from compose, `depends_on` postgres healthcheck).

---

## 3. Files to CHANGE

- `apps/api/src/common/constants/business-exception-codes.ts` — extend `BusinessExceptionCodes`
  enum to the full §5 catalogue (**enum members only**; per-code exception classes are added by their
  owning tasks 2–6):
  `VALIDATION_ISSUE`, `UNHANDLED` (exist), `USER_NOT_FOUND`, `EXERCISE_NOT_FOUND`,
  `MUSCLE_GROUP_NOT_FOUND`, `EXERCISE_MUSCLE_GROUP_ALREADY_EXISTS`, `UNSUPPORTED_SCALE_UNIT`,
  `CROSS_CATEGORY_CONVERSION`, `WORKOUT_ALREADY_EXISTS`, `INVALID_CURSOR`.
- `apps/api/src/app/app.module.ts` — import:
  - `ConfigModule.forRoot({ isGlobal: true, load: [databaseConfig, apiDocumentConfig],
    validationSchema: envValidationJoiSchema, envFilePath: [layered list per §10] })`,
  - `TypeOrmModule.forRootAsync({ inject: [ConfigService], useFactory: … database namespace,
    synchronize: false })`,
  - `TimeContextModule`, `JoiServiceModule`,
  - keep `ExceptionFilterModule`, `AppController`, `AppService` (scaffolded liveness kept — their
    specs stay valid).
- `apps/api/src/main.ts` — add CORS (`app.enableCors()`); keep global prefix `api`; read
  `apiDocument.enabled` from config and **only when true** build the OpenAPI document
  (`@nestjs/swagger` `DocumentBuilder`) and mount Scalar (`@scalar/nestjs-api-reference`); default
  off. Keep `main.ts` free of filter wiring. Bootstrap code — not unit-tested (§7).
- `package.json` — add runtime deps (install with **pnpm**): `@nestjs/config`, `@nestjs/typeorm`,
  `typeorm`, `pg`, `joi`, `@nestjs/swagger`, `@scalar/nestjs-api-reference`, `uuidv7`; and
  `@types/pg` dev dep if needed.
- `README.md` — add an **Environment Variables** section (see §5); add a short API-docs note
  (Scalar at `/api/docs` gated by `API_DOCUMENT__ENABLED`) and a UTC-time trade-off note.

---

## 4. Modules / providers summary

| Concern            | Interface        | Impl          | Token enum / member                              | Module              |
| ------------------ | ---------------- | ------------- | ------------------------------------------------ | ------------------- |
| Time context       | `ITimeContext`   | `TimeContext` | `TimeContextInjectionTokens.CONTEXT__TIME`       | `TimeContextModule` |
| Request validation | `IJoiService`    | `JoiService`  | `JoiServiceInjectionTokens.SERVICE__JOI`         | `JoiServiceModule`  |

Exception filters are already wired (`ExceptionFilterModule`, `APP_FILTER`, correct reverse order) —
unchanged. Config + TypeORM are wired in `app.module.ts` as above.

---

## 5. Environment variables (NEW) — README + example file

All introduced and **validated at boot** via `envValidationJoiSchema`:

| Variable                | Required | Default       | Purpose                                   | Example       |
| ----------------------- | -------- | ------------- | ----------------------------------------- | ------------- |
| `NODE_ENV`              | no       | `development` | config layering / environment             | `development` |
| `PORT`                  | no       | `3000`        | HTTP port                                 | `3000`        |
| `DATABASE__HOST`        | yes      | —             | Postgres host                             | `localhost`   |
| `DATABASE__PORT`        | no       | `5432`        | Postgres port                             | `5432`        |
| `DATABASE__USERNAME`    | yes      | —             | Postgres user                             | `postgres`    |
| `DATABASE__PASSWORD`    | yes      | —             | Postgres password                         | `postgres`    |
| `DATABASE__NAME`        | yes      | —             | Postgres database name                    | `everfit`     |
| `API_DOCUMENT__ENABLED` | no       | `false`       | mount OpenAPI + Scalar when `true`        | `false`       |

- README gets an **Environment Variables** section listing the above with a concrete example block;
  kept in sync with what the config code reads.
- Committed example file populated with the sample values above (no real secrets; `.env.local` and
  `.env.*.local` stay git-ignored).

**FLAG (needs your call) — example-file name.** `architecture-design.md` says create **`.env.example`**;
my Developer role guideline says create **`.env.<project name>`** (i.e. `.env.api`). I will follow the
**confirmed architecture (`.env.example`)** unless you direct otherwise. Say the word and I will use
`.env.api` instead (or add both).

---

## 6. Database impact

- **None.** Task 1 wires TypeORM + the migration toolchain but creates **no entities, tables,
  columns, indexes, or relationships** (`synchronize` off; empty `migrations/`). Tables arrive in
  tasks 2/3/5.
- Therefore **no change to a database diagram** is required for this task.
- Note: `docs/designs/database-diagram.txt` **does not exist yet** (the `docs/designs/` folder is
  empty). I will **not** create it in Task 1 (no schema to document). Per my role I must flag this
  rather than create it silently: when the first entities land (Task 2), I will request approval to
  create `docs/designs/database-diagram.txt` with the then-current schema. No action needed from you
  now.

---

## 7. Test cases to be covered

In-memory DB is not needed for Task 1 (no entities/repositories); the testable units are pure/DI
services and the boot Joi schema. Bootstrap/CLI files (`main.ts`, `data-source.ts`) and plain
type/interface files (`search-result.ts`, `pager.ts`, the reusable schema declarations) contain no
branching logic to unit-test; any excluded branch is noted below.

### 7.1 `apps/api/src/common/time-context/time-context.spec.ts`
`describe('getUtcNowAsync')`:
- returns a value that is an instance of `Date` (resolves). (Single path — no branches.)

### 7.2 `apps/api/src/common/services/joi/joi.service.spec.ts`
`describe('validateAsync')` — covers **both** branches of `error['details'] instanceof Array`:
- returns the **coerced** value on valid input (e.g. numeric string → number via `convert: true`)
  — happy path, no throw.
- throws **`ValidationException`** (exact type) with mapped `ValidationIssue[]` (asserts each
  `issue.message` matches Joi's detail messages) when the schema rejects input — `details` is an
  array branch.
- **re-throws the original non-Joi error unchanged** (e.g. a thrown plain `Error` with no
  `details`), asserting it is NOT wrapped in `ValidationException` — the `else` branch.

### 7.3 `apps/api/src/common/config/env-validation.joi-schema.spec.ts`
`describe('envValidationJoiSchema')`:
- passes (`error` undefined) when all required vars are present and valid.
- **applies defaults** for optional vars — asserts `value.NODE_ENV === 'development'`,
  `PORT === 3000`, `DATABASE__PORT === 5432`, `API_DOCUMENT__ENABLED === false` when omitted
  (coercion/default branch).
- fails when `DATABASE__HOST` is missing (required branch).
- fails when `DATABASE__USERNAME` is missing (required branch).
- fails when `DATABASE__PASSWORD` is missing (required branch).
- fails when `DATABASE__NAME` is missing (required branch).
- fails when `API_DOCUMENT__ENABLED` is a non-boolean string / `PORT` is non-numeric (invalid-type
  branch) — asserts `error` is defined.

### 7.4 `apps/api/src/common/config/database.config.spec.ts`
`describe('databaseConfig')` — covers the `??`-default branches of the `registerAs` factory:
- maps all `DATABASE__*` env vars into the namespace object when present.
- falls back to port `5432` when `DATABASE__PORT` is unset (default branch).

### 7.5 `apps/api/src/common/config/api-document.config.spec.ts`
`describe('apiDocumentConfig')`:
- `enabled === true` when `API_DOCUMENT__ENABLED === 'true'` (truthy branch).
- `enabled === false` when the var is unset/other (default/false branch).

### 7.6 Existing tests
- **Unchanged.** `app.controller.spec.ts`, `app.service.spec.ts`, and the three
  `*.filter.spec.ts` stay exactly as-is — no existing test is modified or deleted (no test-change
  gate triggered; this task is **ready**, not blocked).

**Coverage target:** branch coverage ≥ 80%. The branch-bearing units (JoiService, env schema, the
two config factories) are each fully branch-covered above; plain type files and bootstrap files have
no branches to cover.

---

## 8. Verification steps (Phase 2, after approval)

1. `pnpm add` the deps (§3) with pnpm.
2. Implement in the order: common models/schemas → time-context → joi → config → exception-codes →
   app.module/main → data-source/migrations → docker/env/README.
3. `pnpm nx test api` (with `--coverage`) → green, ≥80% branch.
4. `pnpm nx build api` → compiles. `pnpm nx lint api` → clean for introduced code.
5. Open the **draft** PR (§1). Do not merge, do not mark ready.

---

## 9. Open items for your confirmation

- **O1 — example-file name:** `.env.example` (architecture) vs `.env.api` (role guideline). Default:
  `.env.example`. See §5.
- **O2 — Scalar mount path:** I plan to mount the API reference at `/api/docs` (under the global
  `api` prefix) when enabled. Flag if you prefer a different path.
- **O3 — pager model file split:** `generic.md` one-declaration-per-file may require `pager.ts` to be
  split into `offset-pager.ts` / `cursor-pager.ts`. I will split if needed to satisfy the rule; the
  architecture-design names a single `pager.ts`. No functional impact.

Nothing here contradicts `description.txt` or the confirmed `architecture-design.md`; no change to
`description.txt` is requested.
