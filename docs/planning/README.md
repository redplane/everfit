# Planning & agent workflow

This folder is the shared workspace for the agent team defined in `.claude/agents/`.
The agents hand work off to each other through the files here — no agent re-derives what a
previous one already wrote down.

## The team

| Agent                | Responsibility                                                        | Reads                          | Writes                                 |
| -------------------- | -------------------------------------------------------------------- | ------------------------------ | -------------------------------------- |
| `product-owner`      | Write `goal.md` + resolve open questions, then (after approval) break the spec into features + task folders | `docs/requirement.md`   | `plans/<sprint>/goal.md`, `features.md`, `plans/<sprint>/<N>. <Title>/description.txt` |
| `architect`          | After PO+human finalize tasks: per-task design (DB/API/tests) in dependency order | `features.md`, each `description.txt`, guidelines, src, DB tools | `architecture.md`, `plans/<sprint>/<N>. <Title>/architecture-design.md` |
| `developer`          | Plan a confirmed task, then (after approval) implement + unit-test it; sync DB diagram; one PR per task (stacked if dependent) | a task folder's `description.txt` + `architecture-design.md`, architecture | `implementation-plan.md`, production code under `apps/api/src`, `docs/designs/database-diagram.txt`, a PR |
| `reviewer`           | QA gate: review the diff vs contract + conventions; enforce coverage | the task folder, diff, guidelines | a PASS / CHANGES-REQUESTED verdict (read-only) |
| `ai-workflow-scribe` | Maintain the required AI_WORKFLOW.md deliverable                     | the session, git log           | `AI_WORKFLOW.md` only                  |

All agents strictly follow `docs/guidelines/` — those conventions override any default behavior.

## Artifacts

- `docs/planning/features.md` — the product backlog (feature IDs `F1`, `F2`, …).
- `docs/planning/architecture.md` — the system design (entities, indexes, API contracts, module map).
- `plans/<Monday>_<Friday>/` — the **sprint folder**, named for the current Mon→Fri week
  (e.g. `plans/2026-10-05_2026-10-09`). It contains:
  - `goal.md` — the product-owner's goal summary + open questions. Written **first**; every open
    question must be resolved and the human must approve it **before** features are separated.
  - one sub-folder per task — `plans/<sprint>/<N>. <Task title>/`, e.g. `1. Implement create user api`:
    - `description.txt` — the product spec (the WHAT). **Owned by `product-owner`** — only it may
      edit this file. Any other agent needs the **developer's** confirmation before a change is
      made, and the product-owner applies it.
    - `architecture-design.md` — the architect's plan (the HOW): database changes, API changes,
      and tests. Written per task in dependency order, **only after** the PO and human finalize the
      task division; a task needing an **existing test changed** is marked BLOCKED until the human
      confirms. Implementation transfers to the developer only once the design is confirmed.
    - `implementation-plan.md` — the developer's plan (changes + test cases to cover), written on
      handoff **before any code**; implementation waits for approval of this plan.

Other locations touched by the team:

- `docs/designs/database-diagram.txt` — the schema diagram in **dbdiagram.io (DBML)** syntax, kept
  in sync by the developer whenever a task changes the schema. If it doesn't exist, the developer
  asks the human before creating it.
- **One pull request per task** (branch per task); a task that depends on another is delivered as a
  **stacked PR** based on the dependency's branch.

## How to drive the team

Run them in sequence, reviewing each hand-off before moving on:

1. **Goal & open questions** — `@product-owner analyze the assignment in docs/requirement.md`
   → the PO writes `plans/<sprint>/goal.md` and surfaces open questions. **Answer every open
   question and approve `goal.md`** — the PO won't separate features until you do.
2. **Requirements** — after approval the PO produces `features.md` and the
   `plans/<sprint>/.../description.txt` task folders. Review them.
4. **Finalize tasks** — confirm the task folders + `description.txt` with the product-owner before
   design starts (the architect waits for this).
5. **Design** — `@architect design the tasks in the current sprint folder`
   → the architect goes task-by-task in dependency order, writing each `architecture-design.md`
   (DB / API / tests). Review them; confirm any task marked **BLOCKED** (existing-test change)
   before it proceeds.
6. **Plan the task** — once the design is confirmed:
   `@developer plan "plans/2026-10-05_2026-10-09/1. Implement create user api"`
   → the developer writes `implementation-plan.md` (changes + test cases) and stops. Review it.
7. **Build** — after approving the plan: `@developer implement the approved plan`
   → the developer codes to the guidelines, syncs `docs/designs/database-diagram.txt` if the schema
   changed, runs `pnpm nx test api`, and opens one PR for the task (stacked if it depends on
   another). Review the diff and the test run.
8. **Review (QA gate)** — `@reviewer review the work for "plans/2026-10-05_2026-10-09/1. Implement create user api"`
   → if CHANGES REQUESTED, send the findings back to `@developer`; repeat until PASS, then move to
   the next task respecting `Depends on` order.
9. **Document the AI process** — periodically (or after a notable correction/rejection)
   `@ai-workflow-scribe log this session in AI_WORKFLOW.md` so the required deliverable stays
   current with real, verifiable examples.

Tips:
- Keep tasks small — one coherent unit of work each — so the developer stays deterministic.
- Invoke one agent at a time and read its summary before launching the next; the main thread
  stays the orchestrator.
- If an agent hits a genuine ambiguity it will surface a question rather than guess — answer it,
  or send it back a step (e.g. architect → product-owner).
