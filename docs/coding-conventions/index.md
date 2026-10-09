# Coding Conventions — Index

Depending on the **framework** and the **language** of the project, follow the rules defined in the
matching folder below. Each folder scopes its conventions to a specific technology; the
`best-practices/` folder holds language- and framework-agnostic rules that apply everywhere.

## How to use

1. Identify the language and framework of the code you are writing.
2. Open the folder that matches it and follow the rules inside.
3. Also apply the cross-cutting rules in `best-practices/`.

## Folder naming

- Folders that group a collection of related files use a **plural noun** — e.g. `models`,
  `services`, `controllers`, `exceptions`, `dto`.
- The **casing** follows the naming convention of the framework/language the folder lives in:
  lower-case in TypeScript/NestJS (`models`, `services`), PascalCase in .NET/C# (`Models`,
  `Services`).
- **Exception:** the NestJS **module** folder keeps its singular feature name (e.g.
  `src/modules/apis/user/`, `src/modules/cores/date-time/`), since it is named after the feature,
  not a collection.

## Layout

| Scope                         | Where                       | What it covers                                                                 |
| ----------------------------- | --------------------------- | ----------------------------------------------------------------------------- |
| **Language — TypeScript**     | [`typescript/`](./typescript/) | General TypeScript/language rules — naming, access modifiers, enums, file organization. See [`typescript/generic.md`](./typescript/generic.md). |
| **Framework — NestJS**        | [`typescript/frameworks/nestjs/`](./typescript/frameworks/nestjs/) | NestJS modules, controllers, DTOs, services, validation, request flow, time context. |
| **Persistence — TypeORM**     | [`orms/`](./orms/)          | Entities, naming, and migrations for TypeORM + PostgreSQL. See [`orms/typeorm.md`](./orms/typeorm.md). |
| **Cross-cutting**             | [`best-practices/`](./best-practices/) | Language/framework-agnostic rules that apply to all code.             |

## Contents

### `typescript/` — TypeScript language

- [`generic.md`](./typescript/generic.md) — general language conventions.

### `typescript/frameworks/nestjs/` — NestJS framework

- [`api.md`](./typescript/frameworks/nestjs/api.md) — modules, controllers, DTOs, errors.
- [`request-flow.md`](./typescript/frameworks/nestjs/request-flow.md) — controller request flow / stage order.
- [`request-validation.md`](./typescript/frameworks/nestjs/request-validation.md) — Joi request validation.
- [`service.md`](./typescript/frameworks/nestjs/service.md) — interface-first services, injection tokens, service modules.
- [`time-context.md`](./typescript/frameworks/nestjs/time-context.md) — time context module, token, and usage.

### `orms/` — persistence

- [`typeorm.md`](./orms/typeorm.md) — entities, naming, migrations.

### `best-practices/` — cross-cutting (language/framework-agnostic)

- [`api-documentation.md`](./best-practices/api-documentation.md) — OpenAPI + Scalar, domain grouping, meaningful titles, documenting required roles.
- [`handle-condition.md`](./best-practices/handle-condition.md) — `if ... return` vs `if/else`, and `switch`/`case` for limited value sets.
- [`time-with-di.md`](./best-practices/time-with-di.md) — avoid static time classes in DI frameworks; inject a time context.
