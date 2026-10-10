# Planning & agent workflow

This folder is the shared workspace for the agent team defined in `.claude/agents/`.
The agents hand work off to each other through the files here — no agent re-derives what a
previous one already wrote down.

## The team

| Agent                | Responsibility                                                        | Reads                          | Writes                                 |
| -------------------- | -------------------------------------------------------------------- | ------------------------------ | -------------------------------------- |
| `product-owner`      | Write `goal.md` + resolve open questions, then (after approval) break the spec into features + task folders | `docs/requirement.md`   | `plans/<sprint>/goal.md`, `plans/<sprint>/features.md`, `plans/<sprint>/<N>. <Title>/description.txt` |
| `architect`          | After PO+human finalize tasks: per-task design (DB/API/tests) in dependency order | `plans/<sprint>/features.md`, each `description.txt`, guidelines, src, DB tools | `plans/<sprint>/architecture.md`, `plans/<sprint>/<N>. <Title>/architecture-design.md` |
| `developer`          | Plan a confirmed task, then (after approval) implement + unit-test it; sync DB diagram; one **draft** PR per task (stacked if dependent) | a task folder's `description.txt` + `architecture-design.md`, architecture | `implementation-plan.md`, production code under `apps/api/src`, `docs/designs/database-diagram.txt`, a draft PR |
| `reviewer`           | Code-review gate: review the diff vs contract + conventions; enforce coverage; on PASS hand off to `qa` | the task folder, diff, guidelines | a PASS / CHANGES-REQUESTED verdict (read-only) |
| `qa`                 | External-testing gate after reviewer PASS: no-op for non-API tasks; for API tasks write a test plan (human-approved before the PR goes ready) | the task folder (`description.txt` + `architecture-design.md`), guidelines, DB tools | `plans/<sprint>/<N>. <Title>/tests/test-plan.md` |
| `ai-workflow-scribe` | Maintain the required AI_WORKFLOW.md deliverable                     | the session, git log           | `AI_WORKFLOW.md` only                  |

All agents strictly follow `docs/guidelines/` — those conventions override any default behavior.

## Artifacts

All sprint-planning artifacts live **inside the sprint folder** — there is no separate
`docs/planning/` backlog. (This folder holds only this workflow README.)

- `plans/<Monday>_<Friday>/` — the **sprint folder**, named for the current Mon→Fri week
  (e.g. `plans/2026-10-05_2026-10-09`). It contains:
  - `goal.md` — the product-owner's goal summary + open questions. Written **first**; every open
    question must be resolved and the human must approve it **before** features are separated.
  - `features.md` — the product backlog (feature IDs `F1`, `F2`, …).
  - `architecture.md` — the system design (entities, indexes, API contracts, module map).
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
    - `tests/test-plan.md` — the QA agent's external test scenarios, written **only for API tasks**
      after the reviewer PASSES. Marked DRAFT until a human approves it; that approval is what lets
      the task's **draft PR be marked ready**. Non-API tasks get no `tests/` folder (QA is a no-op).

Other locations touched by the team:

- `docs/designs/database-diagram.txt` — the schema diagram in **dbdiagram.io (DBML)** syntax, kept
  in sync by the developer whenever a task changes the schema. If it doesn't exist, the developer
  asks the human before creating it.
- **One pull request per task** (branch per task), opened as a **draft**; a task that depends on
  another is delivered as a **stacked PR** based on the dependency's branch. A draft PR is marked
  **ready** only after the reviewer PASSES and — for API tasks — QA's `tests/test-plan.md` is
  human-approved.

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
   changed, runs `pnpm nx test api`, and opens one **draft** PR for the task (stacked if it depends
   on another). Review the diff and the test run.
8. **Code review** — `@reviewer review the work for "plans/2026-10-05_2026-10-09/1. Implement create user api"`
   → if CHANGES REQUESTED, send the findings back to `@developer`; repeat until PASS. On PASS the
   reviewer hands off to QA.
9. **QA (external-testing gate)** — `@qa prepare a test plan for "plans/2026-10-05_2026-10-09/1. Implement create user api"`
   → for a **non-API** task QA is a no-op (nothing to black-box test); for an **API** task QA writes
   `tests/test-plan.md`. Review and **approve** it, then mark the draft PR ready (`gh pr ready <n>`)
   and move to the next task respecting `Depends on` order.
10. **Document the AI process** — periodically (or after a notable correction/rejection)
   `@ai-workflow-scribe log this session in AI_WORKFLOW.md` so the required deliverable stays
   current with real, verifiable examples.

Tips:
- Keep tasks small — one coherent unit of work each — so the developer stays deterministic.
- Invoke one agent at a time and read its summary before launching the next; the main thread
  stays the orchestrator.
- If an agent hits a genuine ambiguity it will surface a question rather than guess — answer it,
  or send it back a step (e.g. architect → product-owner).
