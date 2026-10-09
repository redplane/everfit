# Repository Setup Checklist

Use this checklist when setting up or reviewing a repository. Complete every item that
applies to the repository's technology stack.

## Node.js projects

If the repository contains one or more **Node.js** projects, the following MUST be set up:

- [ ] **pnpm** — use pnpm as the package manager (not `npm` or `yarn`). See
      [`../guidelines/index.md`](../guidelines/index.md) for the package-management rule.
- [ ] **Husky** — install and configure [Husky](https://typicode.github.io/husky/) to manage Git hooks.
- [ ] **Git hooks** — wire the Git hooks through Husky (see commit and push rules below).
- [ ] **Lint** — set up linting for every project so it can be run and enforced by the hooks.

## Exception handling

For every **NestJS** project, global exception handling MUST be in place per
[`../guidelines/typescript/frameworks/nestjs/error-handling.md`](../guidelines/typescript/frameworks/nestjs/error-handling.md):

- [ ] **Request parameter validation** — a `ValidationException` + `ValidationExceptionFilter` maps
      Joi validation failures to a stable `400 { code, issues: [{ message }] }`.
- [ ] **Business logic validation** — a `BusinessException` base (extending `HttpException`, carrying a
      stable `code`) with one subclass per domain error, mapped by `BusinessExceptionFilter` to
      `{ code, message }` at the declared status.
- [ ] **Unhandled exceptions** — a catch-all `@Catch()` `UnhandledExceptionFilter` logs full detail
      server-side and returns a safe, generic `500 { code, message }` that never leaks internals
      (message/stack).
- [ ] **Filters registered via `APP_FILTER`** — all three filters are wired as `APP_FILTER` providers
      (not `app.useGlobalFilters` in `main.ts`), with the catch-all registered first so the specific
      filters take precedence.

## Docker

For every buildable/deployable project, the following MUST be set up:

- [ ] **Dockerfile per project** — provide a `Dockerfile-<project name>` at the repository root
      that builds the application (e.g. `Dockerfile-api` for the `api` project). One Dockerfile
      per project, named after the project it builds.
- [ ] **Exposed port matches the code** — the `EXPOSE` instruction in each `Dockerfile-<project name>`
      MUST match the port the application actually listens on in code (e.g. the `api` app listens on
      port `3000` by default in [`../../apps/api/src/main.ts`](../../apps/api/src/main.ts), so
      `Dockerfile-api` MUST `EXPOSE 3000`).

## Git hook rules

### On commit (`pre-commit`)

- [ ] When code is committed, make sure **all projects have no lint errors**. The commit MUST
      be blocked if any project reports a lint error.

### On push (`pre-push`)

- [ ] When code is pushed, make sure **all projects build successfully**. The push MUST be
      blocked if any project fails to build.
