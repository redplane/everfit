# I. Overview

This rule is about how to **document HTTP APIs**. The goal is a consistent, self-describing
API reference that is generated from the code, grouped by domain, and clear about who may call
each endpoint.

# II. Convention

## 1. Use OpenAPI with Scalar as the UI

- For **API projects**, expose the API reference as **OpenAPI** (a.k.a. Swagger/OpenAPI spec)
  rendered with **Scalar** as the documentation UI.
- The **Scalar library to use depends on the back-end framework** — pick the integration that
  matches the stack, for example:
  - NestJS / Node.js → `@scalar/nestjs-api-reference` (serving the generated OpenAPI document).
  - ASP.NET Core / .NET → `Scalar.AspNetCore`.
  - Other frameworks → the corresponding official Scalar package.
- Generate the OpenAPI document from the framework's native tooling, then mount Scalar as the
  viewer over that document.

## 2. Toggle documentation via an environment variable

- Whether the API documentation is served **must not** be hardcoded to a particular environment
  (e.g. "development only"). It **must be controlled by configuration / environment variables** so
  any environment can enable or disable it without a code change.
- Use a dedicated, namespaced config key, following the platform's convention:
  - Environment variable: `API_DOCUMENT__ENABLED=true`
  - Structured config (e.g. .NET `appsettings.json`): `{ "apiDocument": { "enabled": true } }`
- The default should be **disabled** in production-like environments; enabling it is an explicit
  opt-in via the variable. The application reads this flag at startup and only then mounts the
  OpenAPI document + Scalar UI.

## 3. Group APIs by domain

- APIs **must be grouped by domain** so the reference reads as a set of coherent areas, not a flat
  list. Group names are **plural nouns** describing the domain, e.g. `Users`, `Blog posts`,
  `Workouts`.
- In practice the grouping maps to the framework's tagging mechanism (e.g. OpenAPI `tags` — in
  NestJS `@ApiTags('Users')`). Every endpoint belongs to exactly one domain group.

## 4. Use meaningful API titles

- Each endpoint has a **meaningful, human-readable title/summary** describing the action, not the
  method name or route. Prefer an imperative phrase:
  - `Get user by id`
  - `Create a new user`
  - `Update a blog post`
  - `Delete a workout by id`
- Avoid vague or auto-generated titles such as `userControllerGetById` or `GET /users/{id}`.

## 5. Document required permissions

- If an API **requires a permission/authorization check**, the documentation **must state which
  role(s) can access it** — e.g. "Accessible by: `Admin`, `Owner`".
- Include this in the endpoint's description (and, where supported, via the framework's security
  scheme annotations) so a reader knows the access requirement without reading the source.
- Endpoints that are public (no permission check) should say so explicitly, e.g. "Accessible by:
  anyone (public)".
