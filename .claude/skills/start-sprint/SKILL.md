---
name: start-sprint
description: Run a full sprint end-to-end for the Everfit Workout Logging API — from a raw requirement to stacked, review- and QA-gated PRs. Use when the user wants to kick off a sprint: it takes the requirement from the prompt, fixes the sprint folder from today's date (or a human-specified date, warning on a past date), then orchestrates product-owner → architect → developer → reviewer → qa across every task. Each stage gates on human approval; nothing proceeds on assumption.
---

# Start Sprint

Drive a complete sprint for the Everfit Workout Logging API, orchestrating the specialist agents in
order and gating every stage on a human. This skill is the **conductor** — it does not do the
product, architecture, implementation, review, or QA work itself; it hands off to the agent/skill
that owns each stage and keeps the sprint moving one task at a time.

The pipeline is fixed:

```
requirement → sprint folder → product-owner (separate tasks) → architect (design each task)
  → developer (implement one task → open draft PR, stacked on its dependency)
  → reviewer (code-review the task) → qa (external test plan for API tasks)
  → PR marked ready → next task
```

Never skip a stage, never let an agent guess past an open question, and never proceed past a
human-approval gate on assumption.

## 1. Get the requirement

The requirement is whatever the user passes in the prompt — inline text, a pasted spec, a file
path, or a reference to `docs/requirement.md`.

- If a requirement was provided, use it verbatim (or read the referenced file).
- **If nothing analyzable was provided, stop and ask the human for the requirement before doing
  anything else.** Do not invent one.

## 2. Fix the sprint folder (today's date unless the human says otherwise)

The sprint folder is the **Monday → Friday week** that contains the sprint date, named
`plans/<Monday>_<Friday>/` (the convention the product-owner, architect, and developer all expect).

- **Default:** derive the sprint date from **today** (`currentDate` / the system date) and compute
  its Monday→Friday week:
  ```bash
  dow=$(date +%u)                                   # 1=Mon … 7=Sun
  mon=$(date -d "-$((dow-1)) days" +%Y-%m-%d)       # Monday of that week
  fri=$(date -d "-$((dow-1)) days +4 days" +%Y-%m-%d)
  echo "plans/${mon}_${fri}"                        # e.g. plans/2026-10-05_2026-10-09
  ```
- **Human override:** if the human specifies a date (or week) for the sprint, use that date instead
  of today to compute the Monday→Friday folder.
- **Past-date warning:** if the resolved sprint date (today's or the human's) falls **before**
  today, **warn the human explicitly** that the sprint folder is in the past, show the folder name
  it would use, and ask them to confirm or give a corrected date before continuing. Do not silently
  create a backdated sprint.

- **Existing sprint folder → append, don't recreate:** check whether the resolved
  `plans/<Monday>_<Friday>/` folder **already exists**. If it does, this is **not** a fresh sprint —
  the new requirement's tasks are **appended** to the existing sprint:
  - Keep the existing `goal.md` and all existing task folders as-is. Do **not** overwrite, renumber,
    or delete them.
  - New task folders continue the existing numbering (if the folder already holds
    `1. …`, `2. …`, the first new task is `3. …`).
  - Tell the human the folder already exists, list the task folders already in it, and confirm that
    the new requirement will be **added** to this sprint (not replace it) before continuing.
  - Carry this same existing folder through every later stage.

Confirm the exact sprint folder with the human, then let the product-owner create it in the next
step (the product-owner creates the folder if missing, or appends to it if it already exists).
Carry this sprint folder through every later stage so all agents work against the same one.

## 3. Product-owner — analyze & separate tasks

Run the **[`analyze-requirement`](../analyze-requirement/SKILL.md)** skill, passing the requirement
from step 1 and the sprint folder from step 2. That skill owns the product-owner delegation and its
hard guarantee: **every open question is answered by a human** before anything is finalized.

Through that skill, drive the product-owner to:

1. Write `goal.md` (goal, scope, open questions) in the sprint folder. **If the sprint folder
   already existed (step 2 append case),** do not overwrite the existing `goal.md` — extend it with
   the new requirement's goal/scope/open questions, keeping the prior content intact.
2. Get **every** open question answered by a human and the goal **approved**.
3. Only then **separate the features into task folders** — `plans/<sprint>/<N>. <Title>/` each with
   a product-owner-owned `description.txt` and any `Depends on:` lines. **In the append case, new
   task folders continue the existing numbering** and leave the sprint's existing task folders
   untouched; `Depends on:` lines may reference existing tasks in the same sprint.

**Gate:** do not move to the architect until the human has confirmed the goal **and** the task
breakdown (task folders + descriptions + dependency order). The architect designs against a frozen
task list.

## 4. Architect — define the implementation for each task

Launch the **architect** agent (`subagent_type: "architect"`), naming the confirmed sprint folder.
It walks the tasks **in dependency order** and writes an `architecture-design.md` beside each
`description.txt` — database changes, API contracts, module/service/controller layout, and tests —
strictly following `docs/guidelines`. It never edits `description.txt` and writes no production
code.

**Gate:** relay each task's design to the human and get the **implementation work finalized** (the
architect marks a design confirmed vs. `BLOCKED — awaiting human confirmation`). Do not hand a task
to the developer while its design is blocked or unconfirmed.

## 5. Developer → reviewer → qa — one task at a time

Process the tasks **one by one, in dependency order**. For each task, run the full inner loop
before starting the next:

### 5a. Developer implements the task and opens a draft PR

Launch the **developer** agent (`subagent_type: "developer"`), naming the single task folder. The
developer works in two phases:

1. **Plan only** — writes `implementation-plan.md` (files to change + test cases). **Stop and get
   the human's approval of the plan** before any code is written.
2. **Implement** — after approval, implements to the guidelines, keeps the database diagram in
   sync, runs the unit tests, and opens **exactly one draft PR** for the task
   (`gh pr create --draft`).
   - **Stacked PRs:** if the task has a `Depends on:` dependency, the developer branches off the
     dependency's branch and sets the PR base to it, so the diff shows only this task's changes.
   - **Linear-stack tasks that share cumulative files.** Several tasks touch the same growing
     files — notably `docs/designs/database-diagram.txt` and `apps/api/src/app/app.module.ts`. If
     two tasks that each edit such a file both branch off the *same* base, they will **collide at
     merge**. So when a task would otherwise branch off a shared base alongside a sibling that also
     edits a cumulative file, branch it off the **previous task in merge order instead** (a linear
     stack: 1 → 2 → 3 → 4 → 5…), even if its `Depends on:` only names an earlier task. Dependency
     correctness still holds (the needed task is included transitively), the per-PR diff still shows
     only that task's changes, and the cumulative files accumulate conflict-free. We already process
     tasks one at a time, so nothing real is lost.
   - The PR stays a **draft** — it is not marked ready here.

### 5b. Reviewer — code-review gate

Launch the **reviewer** agent (`subagent_type: "reviewer"`) on the finished task. It reports
**PASS** or **CHANGES REQUESTED** with file-and-line findings and enforces the unit-testing rules.

- **CHANGES REQUESTED** → send the task back to the **developer** (5a) to fix, then re-review. Do
  **not** advance to QA.
- **PASS** → hand off to QA.

### 5c. QA — external-testing gate (API tasks only)

Launch the **qa** agent (`subagent_type: "qa"`) on the passed task.

- If the task has **no API changes**, QA is a no-op — the task is done once the reviewer's PASS
  stands.
- If the task **changes the API**, QA writes `tests/test-plan.md` of external scenarios that a
  **human must approve**.

### 5d. Mark the PR ready

Once the reviewer has PASSED **and** (for API tasks) the human has approved QA's test plan, mark the
task's draft PR **ready** (`gh pr ready <n>`). Stacked PRs are marked ready in dependency order so
each stacks cleanly on the one below.

Then move to the next task and repeat 5a–5d until every task in the sprint is done.

## 6. Report back

Summarize the sprint for the human:

- The requirement and the sprint folder used (and any past-date warning raised).
- The goal and the task breakdown (numbers/titles, dependency order), with each open question and
  its human-provided answer.
- Per task: design status, developer PR link (noting draft/ready and whether it is stacked and on
  what), reviewer verdict, and QA status (no-op / test plan approved).
- Anything still pending a human decision — be explicit about what is blocked and on whom.
