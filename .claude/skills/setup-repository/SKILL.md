---
name: setup-repository
description: Audit and set up the repository against docs/checklists/repository-setup.md. Use when the user wants to set up, bootstrap, or review repository tooling — package manager (pnpm), Husky git hooks, pre-commit lint enforcement, and pre-push build enforcement. Reports what is missing and what must be installed, waits for confirmation, then installs and wires it up.
---

# Setup Repository

Bring the repository into compliance with the **Repository Setup Checklist** at
[`docs/checklists/repository-setup.md`](../../../docs/checklists/repository-setup.md).

The flow is always: **audit → report → confirm → install → report back**. Never install
anything before the user confirms.

## 1. Load the checklist

Read [`docs/checklists/repository-setup.md`](../../../docs/checklists/repository-setup.md) and
treat it as the source of truth. The items below reflect it at time of writing; if the checklist
has changed, follow the file, not this list.

## 2. Audit the repository

For each applicable item, determine current state (✅ done / ❌ missing) with concrete evidence:

- **pnpm as package manager** — Check for `pnpm-lock.yaml` (present) vs `package-lock.json` /
  `yarn.lock` (should be absent). Also check `packageManager` field in `package.json` and
  `docs/coding-conventions/index.md` (pnpm is required). Confirm `pnpm` is available on PATH.
- **Husky installed** — Check `.husky/` directory exists and `husky` is in `devDependencies`.
- **Git hooks wired** — Check `.husky/pre-commit` and `.husky/pre-push` exist and are wired
  (e.g. a `prepare` script running `husky` in `package.json`).
- **Lint set up** — Confirm every project has a lint target (`pnpm nx run-many -t lint`
  or `pnpm nx affected -t lint`). ESLint config + `@nx/eslint` are the signal here.
- **pre-commit blocks on lint errors** — `.husky/pre-commit` must run lint across all projects
  and fail the commit on any lint error.
- **pre-push blocks on build failures** — `.husky/pre-push` must build all projects and fail
  the push on any build failure.

This is an **Nx monorepo** — prefer `pnpm nx run-many -t <target>` / `pnpm nx affected -t <target>`
over per-project tooling in the hook scripts (per `CLAUDE.md`).

## 3. Report findings and get confirmation

Present a concise table/list: each checklist item, its status, and — for missing items — exactly
what will be installed or created (package names, files, scripts). Then **ask the user to confirm**
before making any changes. Use the AskUserQuestion tool or a direct question; do not proceed on
assumption.

If the user wants only a subset, honor that.

## 4. Install and wire up (after confirmation)

Apply only the missing pieces. Typical actions:

- **Migrate to pnpm** (if npm/yarn in use): remove `package-lock.json` / `yarn.lock`, run
  `pnpm install` to generate `pnpm-lock.yaml`, and add `"packageManager": "pnpm@<version>"` to
  `package.json`.
- **Install Husky**: `pnpm add -D husky`, then `pnpm exec husky init` (creates `.husky/` and a
  `prepare` script).
- **pre-commit hook** — `.husky/pre-commit` running lint across all projects, e.g.:
  ```sh
  pnpm nx run-many -t lint
  ```
- **pre-push hook** — `.husky/pre-push` running build across all projects, e.g.:
  ```sh
  pnpm nx run-many -t build
  ```

Verify each hook is executable and the scripts actually fail (non-zero exit) on error so the
commit/push is genuinely blocked.

## 5. Report back

Summarize what was done: files created/changed, packages installed, and the final status of every
checklist item (now ✅). Note anything skipped and why, and suggest verifying with a trial commit
and push.
