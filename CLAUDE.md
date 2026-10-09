<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

# CLAUDE.md — Everfit Workout Logging API

## Project Overview

NestJS (Node.js 22 / TypeScript 5) Web API for the Everfit workout-logging assignment,
scaffolded as an **Nx** integrated monorepo. See `docs/requirement.md` for the assignment.

## Workspace Structure

```
api/                                 # Nx workspace root
├── apps/
│   ├── api/                         # NestJS application (app name: "api")
│   │   └── src/
│   │       ├── main.ts              # bootstrap, global prefix "api"
│   │       └── app/                 # root module
│   └── api-e2e/                     # end-to-end tests for the api app
├── docs/
│   ├── requirement.md               # assignment spec
│   └── guidelines/                  # conventions — MUST be followed
│       ├── index.md                 # conventions index + folder-naming rule
│       ├── typescript/
│       │   ├── generic.md           # TypeScript language conventions
│       │   └── frameworks/
│       │       └── nestjs/
│       │           ├── api.md               # NestJS modules/controllers/DTOs/errors
│       │           ├── request-validation.md # Joi request validation
│       │           ├── request-flow.md      # controller request flow / stage order
│       │           ├── service.md           # interface-first services, injection tokens
│       │           └── time-context.md      # time context module, token, usage
│       ├── orms/
│       │   └── typeorm.md           # persistence: entities, naming, migrations
│       └── best-practices/          # language/framework-agnostic rules
│           ├── api-documentation.md # OpenAPI + Scalar, grouping, titles, roles
│           ├── handle-condition.md  # guard clauses, switch/case
│           └── time-with-di.md      # inject a time context, no static time
├── nx.json
└── package.json
```

## Coding Conventions

While generating code, the coding convention located at `docs/guidelines` **must be
strictly followed**. These were adapted from a reference .NET convention set into their
idiomatic NestJS / TypeScript equivalents: features are separated by **modules** under
`src/modules/<module-name>/` (no CQRS), persistence via TypeORM + PostgreSQL, a global exception
filter, and **explicit** input validation via **Joi** (NestJS / class-validator annotations are
not used).

## Commands

- Prefer running tasks through Nx: `npx nx build api`, `npx nx serve api`,
  `npx nx test api`, `npx nx lint api`, `npx nx e2e api-e2e`.

## Git

- `node_modules`, `dist`, and Nx caches (`.nx/cache`, `.nx/workspace-data`) are git-ignored.
- Ignore environment secret files: `.env.local`, `.env.*.local`.
- Keep commit history iterative and meaningful (the assignment evaluates git log).
