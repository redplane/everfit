# Repository Setup Checklist

Use this checklist when setting up or reviewing a repository. Complete every item that
applies to the repository's technology stack.

## Node.js projects

If the repository contains one or more **Node.js** projects, the following MUST be set up:

- [ ] **pnpm** — use pnpm as the package manager (not `npm` or `yarn`). See
      [`../coding-conventions/index.md`](../coding-conventions/index.md) for the package-management rule.
- [ ] **Husky** — install and configure [Husky](https://typicode.github.io/husky/) to manage Git hooks.
- [ ] **Git hooks** — wire the Git hooks through Husky (see commit and push rules below).
- [ ] **Lint** — set up linting for every project so it can be run and enforced by the hooks.

## Git hook rules

### On commit (`pre-commit`)

- [ ] When code is committed, make sure **all projects have no lint errors**. The commit MUST
      be blocked if any project reports a lint error.

### On push (`pre-push`)

- [ ] When code is pushed, make sure **all projects build successfully**. The push MUST be
      blocked if any project fails to build.
