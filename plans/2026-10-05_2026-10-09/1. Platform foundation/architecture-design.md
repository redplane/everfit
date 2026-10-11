# Architecture Design — Task 1: Platform foundation

- **Task:** `1. Platform foundation` — Feature **F1**.
- **Depends on:** none (foundational — everything else builds on this).
- **Goal:** Establish the shared plumbing — Joi validation, exception filters + error-code
  catalogue, injected time context, layered config with env validation, TypeORM wiring, and
  env-gated OpenAPI/Scalar docs — so tasks 2–9 do not re-invent cross-cutting concerns.

See `plans/2026-10-05_2026-10-09/architecture.md` §5, §6, §7, §10 for the system view.

## Database changes

- **No tables yet.** This task only wires **TypeORM** (`TypeOrmModule.forRootAsync` from config) and
  the migrations toolchain: `src/data-source.ts` (CLI data source), an empty `src/migrations/`
  folder, and the `migration:generate/run/revert` workflow. No entities are created here (they
  arrive in tasks 2, 3, 5). `synchronize` stays **off**.

## API changes

- **No business endpoints.** Keep the scaffolded `GET /` (`AppController`/`AppService`) as a
  trivial liveness response (optionally relabel to a health check) — do **not** delete it (keeps its
  existing specs valid). Add the OpenAPI document + Scalar UI mounting (gated), not an endpoint.

## Environment variables (api)

All variables from `architecture.md` §10 are introduced and **validated at boot via Joi**:
`NODE_ENV` (opt, `development`), `PORT` (opt, `3000`), `DATABASE__HOST` (req), `DATABASE__PORT`
(opt, `5432`), `DATABASE__USERNAME` (req), `DATABASE__PASSWORD` (req), `DATABASE__NAME` (req),
`API_DOCUMENT__ENABLED` (opt, `false`). Provide `.env.example` (committed) documenting them;
`.env.local` stays git-ignored.

## Contract (interfaces/providers to implement)

- `ITimeContext` / `TimeContext` (`getUtcNowAsync(): Promise<Date>`), token enum
  `TimeContextInjectionTokens.CONTEXT__TIME`, `TimeContextModule` — per `time-context.md`.
- `IJoiService` / `JoiService` (`validateAsync<T>(instance, schema): Promise<T>`), token
  `JoiServiceInjectionTokens.SERVICE__JOI`, `JoiServiceModule` — per `request-validation.md`.
- Config: `src/common/config/database.config.ts`, `api-document.config.ts` (namespaced via
  `registerAs`), and `env-validation.joi-schema.ts` for `ConfigModule.forRoot({ validationSchema })`.
- Common models: `SearchResult<T>` (`src/common/models/search-result.ts`) and offset/cursor pager
  models (`src/common/models/pager.ts`) per `architecture.md` §9.
- Reusable Joi schemas used across modules: `offset-pager.joi-schema.ts`,
  `cursor-pager.joi-schema.ts` in `src/common/schemas/`.
- Extend `BusinessExceptionCodes` to the full catalogue in `architecture.md` §5 (enum members only;
  per-code exception classes are added by their owning tasks).

## Files to create/change

Create:
- `src/common/time-context/time-context.interface.ts`, `time-context.ts`,
  `time-context-injection-tokens.ts`, `time-context.module.ts`.
- `src/common/services/joi/joi-service.interface.ts`, `joi.service.ts`,
  `joi-injection-tokens.ts`, `joi.module.ts`.
- `src/common/models/search-result.ts`, `src/common/models/pager.ts`.
- `src/common/schemas/offset-pager.joi-schema.ts`, `src/common/schemas/cursor-pager.joi-schema.ts`.
- `src/common/config/database.config.ts`, `src/common/config/api-document.config.ts`,
  `src/common/config/env-validation.joi-schema.ts`.
- `src/data-source.ts`; `src/migrations/` (folder).
- `.env.example`; `Dockerfile`; `docker-compose.yml` (api + postgres) — postgres compose exists,
  add the api service.

Change:
- `src/common/constants/business-exception-codes.ts` — add the catalogue members (§5).
- `src/app/app.module.ts` — import `ConfigModule` (global, layered), `TypeOrmModule.forRootAsync`,
  `TimeContextModule`, `JoiModule`; keep `ExceptionFilterModule`.
- `src/main.ts` — CORS; gate OpenAPI (`@nestjs/swagger`) + Scalar (`@scalar/nestjs-api-reference`)
  behind `API_DOCUMENT__ENABLED`; keep global prefix `api`.
- `package.json` — add deps: `@nestjs/config`, `@nestjs/typeorm`, `typeorm`, `pg`, `joi`,
  `@nestjs/swagger`, `@scalar/nestjs-api-reference`, `uuidv7` (install with **pnpm**).

## Tests to define

- `src/common/time-context/time-context.spec.ts` — `getUtcNowAsync` returns a `Date`.
- `src/common/services/joi/joi.service.spec.ts` — `validateAsync`: (a) returns the coerced value on
  valid input; (b) throws `ValidationException` with mapped `ValidationIssue[]` on a Joi error;
  (c) re-throws a non-Joi error unchanged (both branches of the `details instanceof Array` guard).
- `src/common/config/env-validation.joi-schema.spec.ts` — passes with required vars present; fails
  when a required DB var is missing; applies defaults for optional vars (each branch).

The three existing filter specs and `app.*.spec.ts` remain valid and unchanged.

## Existing tests that must change

- **None.** The scaffolded `app.controller.spec.ts`, `app.service.spec.ts`, and the three
  `*.filter.spec.ts` stay as-is (the sample controller/service are intentionally kept). No existing
  test is modified or deleted → this task is **ready**, not blocked.

## Done when

- `pnpm nx test api` passes (new + existing specs); `pnpm nx build api` succeeds; `pnpm nx lint api`
  clean. App boots with layered config + env validation; Scalar is served only when
  `API_DOCUMENT__ENABLED=true` and absent otherwise; a trivial migration can be generated and run.
  Conventions in `api.md`, `service.md`, `request-validation.md`, `error-handling.md`,
  `time-context.md`, `typeorm.md` met.
