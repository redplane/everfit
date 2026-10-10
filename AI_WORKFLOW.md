# AI Workflow

How AI was used to build the Everfit Workout Logging API, and — more importantly — how it
was **directed, corrected, and overruled**. This is an honest record; every example below is
anchored to a real commit or PR from this sprint (PRs #2–#10, sprint folder
`plans/2026-10-05_2026-10-09/`).

---

## 1. Tools & Purpose

**Claude Code (Opus)** was the single tool, used as an *orchestrator* rather than an autocomplete.
A `start-sprint` skill drove a fixed pipeline of specialized subagents
(`.claude/agents/`), each with a narrow charter:

| Agent | Responsibility | Used for |
| --- | --- | --- |
| `product-owner` | Turn the requirement into a goal + open questions | Architecture / scoping |
| `architect` | Per-feature design (ER diagram, modules, contracts) | Architecture |
| `developer` | Implement one task per branch | Coding |
| `reviewer` | Independent code review | Debugging / quality |
| `qa` | Black-box test the *running* app | Testing |
| `ai-workflow-scribe` | Maintain this document | Documentation |

Separation of duties was deliberate and adversarial: the agent that wrote the code never
reviewed or QA'd it. Nine tasks shipped as **stacked, review- and QA-gated PRs (#2–#10)**.

---

## 2. Where AI Was Wrong or Suboptimal (and the fix)

### 2.1 Task 2 — green unit tests, dead app (PR #3)

- **Context:** User master-data module. All provider-level unit tests passed.
- **What the AI produced:** Three defects that unit tests structurally *could not* catch
  because they hand-wire their own `TestingModule`:
  1. Exported an injection **token** from `UserModule` instead of exporting the **providing
     module** → `UnknownExportException`, `AppModule` failed to init.
  2. Set the controller path to `'api/users'` while a global `'api'` prefix already existed →
     routes resolved to `/api/api/users`.
  3. `UserServiceModule` didn't import `TimeContextModule` for an injected dependency.
- **Why it was wrong:** The app could not boot; the tests gave false confidence because they
  never composed the real `AppModule`.
- **What we did instead:** Fixes landed in `2bb3b5d` (module wiring), `3240bf9` (drop repeated
  prefix), and a bootstrap smoke test in `c9f249e`. More importantly, this became a **standing
  policy**: every API task must ship an `AppModule` bootstrap smoke test that composes the
  **real** `AppModule` over an in-memory `pg-mem` DB, asserts routes respond, and asserts
  `/api/api/...` 404s. That policy later caught the Task 5 bug below.

### 2.2 Task 4/5 — DI can't read TypeScript default params (PR #5/#6)

- **Context:** Category-based scale-unit conversion service (`a861566`).
- **What the AI produced:** Registered the conversion service with `useClass`, while its
  constructor relied on a **TS default parameter value** (an optional registry).
- **Why it was wrong:** Nest's DI container does not honor TypeScript default parameter
  values — it tries to resolve every constructor argument from the graph. The real DI graph
  couldn't resolve the provider and the app failed to boot. This was surfaced by Task 5's
  bootstrap smoke test (the policy from 2.1 paying off).
- **What we did instead:** Switched the provider registration to `useFactory` so the optional
  dependency is supplied explicitly.

### 2.3 Task 9 — docs described a safety property the code didn't have (PR #10)

- **Context:** Database reset CLI (`09536f6`).
- **What the AI produced:** Interface JSDoc + README described `reset` as a child-first `DELETE`
  "in a single transaction," but the implementation used per-table `TRUNCATE ... CASCADE` —
  each statement **autocommits**, so it is *not* a single transaction.
- **Why it was wrong:** The reviewer flagged a stale, misleading comment asserting a safety
  (atomicity) property the code did not provide.
- **What we did instead:** Corrected both the JSDoc and README in `3514335`. (Related: the first
  `DELETE`-based implementation took **253s** on a seeded DB; switching to `TRUNCATE ... CASCADE`
  brought it sub-second — the perf win is why the mechanism changed in the first place.)

---

## 3. Where an AI Suggestion Was Rejected

### 3.1 Flat enum + wrong doc location → category abstraction (architecture)

The architect first designed a flat `WeightUnits` enum and placed planning docs under
`docs/planning/`. **Rejected on two counts:**
- Planning artifacts must live in `plans/<sprint>/`, not `docs/planning/`.
- Units must be a **category-based abstraction**: a `ScaleUnit { code, name, description,
  category }` with a conversion service that only converts *within* a category (weight, length,
  …), so adding a unit or a whole category is a minimal change.

The design was reworked accordingly (shipped as Task 4, `a861566`).

### 3.2 Other rejected / changed suggestions

- **N+1 lookup rejected (Task 6).** The developer proposed resolving exercise names for the
  history page via per-distinct-id lookups. Changed to a batched `getByIdsAsync`
  (`dd8ab85`).
- **Pure-UTC period boundaries rejected (Task 8).** The developer planned to compute named-period
  boundaries in pure UTC. We required a `timezone` (IANA) parameter so boundaries are computed in
  the caller's wall-clock time and then converted to UTC — which led to adopting **luxon** for
  DST-correct math (`527c2d3`, `9ed275c`).
- **200-with-null rejected (Task 8).** The confirmed design returned `200` with null metrics for
  an unknown exercise. Changed to **`404 EXERCISE_NOT_FOUND`** for clarity and consistency with
  unknown-user → `404 USER_NOT_FOUND`.

---

## 4. Prompting Strategy

- **Decompose the requirement first.** The spec was turned into a `goal.md` with **explicit open
  questions**, each answered by a human and recorded incrementally *before* any feature breakdown.
  Nothing proceeded on assumption.
- **Full-context handoffs, rules made explicit.** Each task/stage got a detailed handoff prompt,
  and all binding rules (`docs/guidelines/`, `CLAUDE.md`) were embedded in each agent's prompt
  rather than relied on implicitly.
- **Human approval gates at every stage** — goal open-questions, each design, each plan, each QA
  test plan. The pipeline stopped and waited for approval between stages.
- **Adversarial separation of duties** — developer implements, a *separate* reviewer code-reviews,
  a *separate* QA black-box tests the running app.
- **Capture process fixes as durable config, not memory.** The bootstrap-smoke-test policy
  (§2.1), linear PR stacking for shared cumulative files, and a required Mermaid ER diagram in
  `architecture.md` were all written back into the agents/skills so they hold for every future
  task.
