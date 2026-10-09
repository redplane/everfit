# Api

<a alt="Nx logo" href="https://nx.dev" target="_blank" rel="noreferrer"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.png" width="45"></a>

✨ Your new, shiny [Nx workspace](https://nx.dev) is ready ✨.

[Learn more about this workspace setup and its capabilities](https://nx.dev/nx-api/nest?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) or run `npx nx graph` to visually explore what was created. Now, let's get you up to speed!

## Local database (Docker Compose)

A `docker-compose.yml` is provided to run a local PostgreSQL database for the API.

Start the database in the background (project name `everfit`):

```sh
docker compose -p everfit up -d
```

This starts a `postgres:16-alpine` container (`everfit-postgres`) with:

| Setting  | Value                      |
| -------- | -------------------------- |
| Host     | `localhost`                |
| Port     | `5432`                     |
| Database | `everfit`                  |
| Username | `postgres`                 |
| Password | set in `docker-compose.yml`|

Data is persisted in the `postgres-data` named volume, so it survives restarts.

Check status and view logs:

```sh
docker compose -p everfit ps
docker compose -p everfit logs -f postgres
```

Stop the database (keep data):

```sh
docker compose -p everfit down
```

Stop and remove all data:

```sh
docker compose -p everfit down -v
```

## Environment Variables

The `api` project reads its configuration from environment variables via a layered
`@nestjs/config` setup (`.env.api.local` overrides `.env.api`). All variables are **validated at
boot** — required variables with no default will fail startup if missing.

A committed sample lives at **`.env.api.example`**. Copy it to the git-ignored `.env.api` and fill
in real values for local development:

```sh
cp .env.api.example .env.api
```

| Variable                | Required | Default       | Purpose                                     | Example     |
| ----------------------- | -------- | ------------- | ------------------------------------------- | ----------- |
| `NODE_ENV`              | no       | `development` | runtime environment / config layering       | `development` |
| `PORT`                  | no       | `3000`        | HTTP port the API listens on                | `3000`      |
| `DATABASE__HOST`        | yes      | —             | PostgreSQL host                             | `localhost` |
| `DATABASE__PORT`        | no       | `5432`        | PostgreSQL port                             | `5432`      |
| `DATABASE__USERNAME`    | yes      | —             | PostgreSQL user                             | `postgres`  |
| `DATABASE__PASSWORD`    | yes      | —             | PostgreSQL password                         | `postgres`  |
| `DATABASE__NAME`        | yes      | —             | PostgreSQL database name                    | `everfit`   |
| `API_DOCUMENT__ENABLED` | no       | `false`       | mount OpenAPI + Scalar at `/api/docs` when `true` | `false` |

> **Note:** `.env.api` is git-ignored (never commit real secrets). Only `.env.api.example` — with
> placeholder values — is committed.

## API documentation

Interactive API reference (OpenAPI rendered with [Scalar](https://scalar.com)) is **gated** and
**off by default**. Set `API_DOCUMENT__ENABLED=true` and the reference is served at
`http://localhost:<PORT>/api/docs`.

## Database migrations

Schema changes are applied through TypeORM migrations (never `synchronize`). The CLI data source is
`apps/api/src/data-source.ts`; migrations live in `apps/api/src/migrations/`:

```sh
# generate a migration from the current entity diff
pnpm migration:generate ./apps/api/src/migrations/<ChangeName>
# apply / revert
pnpm migration:run
pnpm migration:revert
```

> These scripts run the TypeScript-aware TypeORM CLI (`typeorm-ts-node-commonjs`) against
> `apps/api/src/data-source.ts`, which loads env from `.env.api`.

## Time & timezone

All instants are stored in UTC (`timestamptz`). Business code obtains the current time from an
injected `TimeContext` (never `new Date()` directly), so time is deterministic in tests.

## Run tasks

To run the dev server for your app, use:

```sh
npx nx serve api
```

To create a production bundle:

```sh
npx nx build api
```

To see all available targets to run for a project, run:

```sh
npx nx show project api
```

These targets are either [inferred automatically](https://nx.dev/concepts/inferred-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) or defined in the `project.json` or `package.json` files.

[More about running tasks in the docs &raquo;](https://nx.dev/features/run-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Add new projects

While you could add new projects to your workspace manually, you might want to leverage [Nx plugins](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) and their [code generation](https://nx.dev/features/generate-code?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) feature.

Use the plugin's generator to create new projects.

To generate a new application, use:

```sh
npx nx g @nx/nest:app demo
```

To generate a new library, use:

```sh
npx nx g @nx/node:lib mylib
```

You can use `npx nx list` to get a list of installed plugins. Then, run `npx nx list <plugin-name>` to learn about more specific capabilities of a particular plugin. Alternatively, [install Nx Console](https://nx.dev/getting-started/editor-setup?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) to browse plugins and generators in your IDE.

[Learn more about Nx plugins &raquo;](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) | [Browse the plugin registry &raquo;](https://nx.dev/plugin-registry?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Set up CI!

### Step 1

To connect to Nx Cloud, run the following command:

```sh
npx nx connect
```

Connecting to Nx Cloud ensures a [fast and scalable CI](https://nx.dev/ci/intro/why-nx-cloud?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) pipeline. It includes features such as:

- [Remote caching](https://nx.dev/ci/features/remote-cache?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Task distribution across multiple machines](https://nx.dev/ci/features/distribute-task-execution?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Automated e2e test splitting](https://nx.dev/ci/features/split-e2e-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Task flakiness detection and rerunning](https://nx.dev/ci/features/flaky-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

### Step 2

Use the following command to configure a CI workflow for your workspace:

```sh
npx nx g ci-workflow
```

[Learn more about Nx on CI](https://nx.dev/ci/intro/ci-with-nx#ready-get-started-with-your-provider?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Install Nx Console

Nx Console is an editor extension that enriches your developer experience. It lets you run tasks, generate code, and improves code autocompletion in your IDE. It is available for VSCode and IntelliJ.

[Install Nx Console &raquo;](https://nx.dev/getting-started/editor-setup?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Useful links

Learn more:

- [Learn more about this workspace setup](https://nx.dev/nx-api/nest?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Learn about Nx on CI](https://nx.dev/ci/intro/ci-with-nx?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Releasing Packages with Nx release](https://nx.dev/features/manage-releases?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [What are Nx plugins?](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

And join the Nx community:

- [Discord](https://go.nx.dev/community)
- [Follow us on X](https://twitter.com/nxdevtools) or [LinkedIn](https://www.linkedin.com/company/nrwl)
- [Our Youtube channel](https://www.youtube.com/@nxdevtools)
- [Our blog](https://nx.dev/blog?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
