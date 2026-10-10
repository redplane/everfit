# Sprint Goal — Everfit Workout Logging API

Sprint: 2026-10-05 → 2026-10-09
Source: `docs/requirement.md`
Status: **APPROVED by human on 2026-10-09 — proceeding to feature list and task folders.**

---

## Goal

Deliver a production-ready **Workout Logging API** that lets a coach track a client's
workout metrics over time. The outcome we want:

- A coach can **log** what a client did in a session — one or many exercises at once —
  with each set's reps, weight, and weight unit, and have the system store a
  normalized weight so later queries are unit-agnostic.
- A coach can **review history** — pull back a client's logged workouts, narrowed by
  exercise, date range, or muscle group, paginated, and returned in whatever weight
  unit they ask for.
- A coach can **see progress** — for a client + exercise, surface personal records
  (heaviest set, highest-volume set, best estimated 1RM) with the date each was hit,
  and compare records between two time windows.

Success is judged on the assignment's evaluation axes: thoughtful **system/schema
design** (indexing, aggregation efficiency at 50k+ entries), clean **REST API design**
(consistent errors, pagination, filtering, validation), **extensible architecture**
(pluggable units, configurable muscle-group mapping), robust **error handling**,
**test design**, and **production readiness** (Docker, logging, config).

---

## Scope & assumptions

### In scope
- **Minimal user master data** — a users table / user entity plus **existence validation**
  on reads (so an unknown `userId` yields a 404; see Q9). Still **no authentication** —
  `userId` is passed as a parameter per the spec. This is foundational: other read
  features depend on it.
- Logging workout entries, including **bulk** (multiple exercises per request).
- Weight **unit conversion** (kg ↔ lb) with a normalized stored value, and an
  abstraction that makes adding a new unit (e.g. stone) a minimal change.
- Workout **history** retrieval with filtering (exercise partial match, date range,
  muscle group), pagination, and output-unit selection.
- **Personal records** (max weight, max volume, best Epley 1RM) with achievement dates
  and cross-time-range comparison.
- **Configurable** exercise → muscle-group mapping (not hardcoded in business logic).
- Edge-case / error handling per the spec.
- Production-readiness concerns: Docker, structured logging, config management,
  performance awareness, timezone strategy documentation.
- A **database command-line tool** with two operations — (1) clean up / reset the DB to a
  clean state, and (2) re-seed master data plus a **50,000+**-entry workout dataset for
  performance demonstration (see Q10). Seed data respects all decided model rules.

### Assumptions (from the spec / existing conventions)
- **No authentication.** `userId` is passed as a parameter; the API trusts it.
- **NestJS** on Node 22 / TS 5, in the existing Nx monorepo (`apps/api`).
- **PostgreSQL + TypeORM** per the project conventions (`docs/guidelines/orms/typeorm.md`).
  (Spec allowed Mongo or Postgres; the repo is already set up for Postgres.)
- **Joi** for request validation, global exception filter, module-per-feature layout —
  per `docs/guidelines`.
- Weights are stored normalized in **kg** alongside the original value + unit
  (explicitly required by the spec).
- Timezone strategy: **store in UTC** (spec's recommendation); exact handling of the
  client-supplied `date` is an open question below.

### Out of scope
- Authentication / authorization, user accounts, coach-client relationship management.
- Creating/editing an exercise catalogue as a user-facing feature (beyond whatever
  minimal metadata backs muscle-group mapping — see open questions).
- Workout program/plan creation (the broader Everfit product), scheduling, notifications.
- Front-end / UI; the video walkthrough and `AI_WORKFLOW.md` deliverables are owned
  outside this backlog (scribe agent handles the AI log).

---

## Open questions (resolve before features)

Each must be answered and marked resolved, then the whole doc approved, before I
separate features or create task folders.

- [x] **Q1 — Entry/set data model granularity.** Is a "workout entry" one record per
  (user, date, exercise) carrying an array of sets, or is each set its own queryable
  row? This drives schema, indexing, and PR-aggregation efficiency at 50k+ entries.
  Any preference, or should the architect decide?
  **RESOLVED — Option B: one row per set.** Each set is its own queryable row
  (user_id, date, exercise_name, reps, weight, unit, weight_kg, …), optionally with a
  parent entry row to group the sets from one log action. Rationale: per-set granularity
  makes the PR aggregations (max weight, max volume, best 1RM) index-backed and efficient
  at 50k+ entries. The architect owns the exact grouping/parent-row decision.

- [x] **Q2 — Exercise & muscle-group source of truth.** The spec says muscle group is
  available "if exercise metadata is available" and the mapping must be **configurable**.
  How should exercises be identified and mapped?
  (a) free-text `exerciseName` only, with a config file / seed table mapping name →
  muscle group(s); (b) a managed exercise catalogue entity the coach must pick from;
  (c) exercises created on first use. Also: can one exercise belong to **multiple**
  muscle groups?
  **RESOLVED — Option (b): managed master-data tables.** Both `exercise` and
  `muscle_group` are managed master-data (catalogue) tables. Workout log rows **reference
  an existing exercise** (not free-text create-on-first-use), and the
  exercise→muscle-group mapping is held **relationally** (configurable, not hardcoded in
  business logic).
  _Cardinality (confirmed):_ **many-to-many** between `exercise` and `muscle_group` — one
  exercise can affect multiple muscle groups, and a muscle group spans many exercises,
  modeled via a **join table**. The `(exercise, muscle_group)` pair must be **unique** (a
  unique constraint so a mapping can't be duplicated). The architect models the join table
  + unique constraint.

- [x] **Q3 — `date` semantics & timezone.** Is the logged `date` a **calendar date**
  (the day the workout happened, no time) or a full **timestamp**? If the client sends a
  timezone-less date, do we store it as UTC midnight, or should the coach pass a
  timezone? This affects date-range filtering and "this month vs last month" PR
  comparisons.
  **RESOLVED — store date/time in UTC.** The workout date is kept as a full **UTC
  timestamp**, normalized to UTC so it does **not** depend on the database/server
  timezone. Date-range filtering and "this month vs last month" comparisons operate in
  UTC. The API documents this UTC-storage strategy with trade-offs (per the spec). The
  architect decides the concrete column type (e.g. `timestamptz` vs an explicitly-UTC
  timestamp) consistent with the `time-with-DI` time-context conventions in
  `docs/guidelines`.

- [x] **Q4 — Pagination style.** Spec allows **cursor-based OR offset**. Pick one for
  consistency (cursor scales better for 50k+; offset is simpler). Preference?
  **RESOLVED — hybrid, chosen by dataset size.**
  - **Offset pagination** for small/bounded master-data lists (e.g. exercises, muscle
    groups) — simple and sufficient at that size.
  - **Cursor-based (keyset) pagination** for large datasets, specifically workout
    **history** — scales for 50k+ entries per user and stays stable under concurrent
    inserts.
  The architect defines the concrete contract for each (offset: `limit`/`offset` or
  `page`/`pageSize`; cursor: opaque cursor + limit, ordering key) consistent with
  `docs/guidelines`.

- [x] **Q5 — PR comparison contract.** For "PR this month vs last month," should the API
  accept **two explicit date ranges** to compare, or named periods (this/last month)?
  And what's returned — each period's PRs side by side plus a computed delta, or just the
  two sets? Confirm the three PR types (max weight, max volume, best 1RM) are each
  reported with their own achievement date.
  **RESOLVED — named relative periods, NOT arbitrary date ranges.** The comparison is
  driven by a named period **granularity** computed from the **current time** (via the
  injected time context / `time-with-DI` convention — no static `now`):
  - current week vs last week
  - this month vs last month
  - this year vs last year

  The client picks a granularity (week / month / year) and the API compares the current
  period against the immediately preceding period of that granularity; period boundaries
  are derived from the current time and are **UTC-based** (consistent with Q3).
  _Pending sub-detail:_ the exact **response shape** — each period's three PRs (max
  weight, max volume, best 1RM, each with its achievement date) side-by-side **plus a
  computed delta**, vs just the two period result sets — is still being confirmed by the
  human. Does not block the feature split.

- [x] **Q6 — Units: supported set + output.** Confirm input units are **kg** and **lb**
  only for this sprint (stone is just the extensibility example, not required to ship).
  For history/PR responses, is the output unit a **per-request parameter** (default kg?),
  and does it apply to PR responses as well as history?
  **RESOLVED — two units for now: kg and lb.** Units must be **defined in code** (e.g. an
  enum / unit registry carrying each unit's conversion factor to the normalized kg) so the
  conversion mechanism is abstracted and adding a new unit later (e.g. stone) is a minimal,
  localized code change — satisfying the spec's extensibility requirement. No hardcoded
  conversion logic scattered through business code.
  _Pending sub-detail:_ on reads — whether the **output unit is a per-request parameter**,
  its **default** (likely kg, the normalized unit), and whether it applies to **PR
  responses** as well as history — is still being confirmed by the human. Does not block
  the feature split.

- [x] **Q7 — Bulk logging semantics.** On a bulk request where some entries are valid and
  some invalid, is it **all-or-nothing** (reject whole request, one transaction) or
  **partial success** (log the valid ones, report per-item errors)? This shapes the API
  response contract and transaction handling.
  **RESOLVED — all-or-nothing.** A bulk log request is a **single atomic transaction**. If
  **any** entry/set in the request fails validation or persistence, the entire request is
  rejected and **nothing** is written; the response returns a structured error identifying
  the problem(s). No partial success / no per-item partial commit. The architect ensures
  the write path wraps the whole batch in one DB transaction.

- [x] **Q8 — "Concurrent writes: same user, same exercise, same time."** What is the
  desired behavior — allow duplicate entries (idempotent-unaware), **deduplicate**, or
  reject duplicates via a uniqueness rule? Need the intended semantics to define
  acceptance criteria. (The architect owns the locking/constraint mechanism.)
  **RESOLVED — reject duplicates via a DATABASE unique constraint.** A unique constraint is
  enforced at the DB level; a colliding/concurrent insert fails at the database rather than
  relying on app-level checks, so it is **race-safe**. The app translates the constraint
  violation into a structured **conflict error (HTTP 409)**. Consistent with Q7
  (all-or-nothing): a duplicate inside a bulk request is a failure that rolls back the
  entire batch.
  _Architect-owned sub-detail (does not block the feature split):_ the **uniqueness key
  granularity** must be chosen so it does **not** reject a *legitimate* repeated set —
  because Q1 is row-per-set, a lifter can genuinely perform two identical sets. The key
  likely needs a precise `performed_at` timestamp and/or a set ordinal to distinguish real
  repeats from true duplicates. The architect defines the concrete constraint columns.

- [x] **Q9 — Reads of data for non-existent users.** With no auth and `userId` as a
  free parameter, should history/PR for an unknown `userId` return an **empty result**
  (consistent with the "empty range returns empty, not error" rule) rather than 404?
  Confirm.
  **RESOLVED — return 404 `USER_NOT_FOUND` when the user does not exist** (not a silent
  empty result). This cleanly distinguishes two cases:
  - **Unknown user** → `404` with stable application error code `USER_NOT_FOUND`.
  - **Known user but no matching data** in the requested exercise / date-range /
    muscle-group filter → still returns an **empty result, NOT an error** (per the spec's
    explicit "date ranges with no data return empty, not an error" rule).

  The error code follows the `docs/guidelines` API error-handling convention: a structured
  error body with a stable application error code `USER_NOT_FOUND`, realized via a
  not-found business exception (e.g. `UserByIdNotFoundException` extending
  `BusinessException`) — the architect confirms the concrete exception class.

  **Scope implication (captured in Scope above):** because reads must 404 on an unknown
  user, `userId` must reference a **real** user, so the system needs a **users master
  table / user entity**, and read endpoints **validate the user exists** before querying.
  This is new **foundational** scope — likely an early task other features depend on. Still
  **no authentication**: `userId` is passed as a parameter per the spec.

- [x] **Q10 — Seed / sample data.** Do you want a seed script generating 50k+ entries for
  a user to demonstrate performance (useful for the video walkthrough), or is that out of
  scope for the backlog?
  **RESOLVED — yes, in scope.** Provide a **command-line tool** with two operations:
  1. **Clean up / reset the database** — drop or truncate data to a clean state.
  2. **Re-seed data** — seed master data (users, exercises, muscle groups) **and** a large
     workout dataset (**50,000+** entries for a user) to demonstrate query/aggregation
     performance at scale (useful for the video walkthrough).

  The architect/developer pick the concrete mechanism (e.g. an Nx target / Nest standalone
  command script) consistent with `docs/guidelines`. Seed data must respect all model rules
  decided above: **row-per-set** (Q1), **UTC timestamps** (Q3), **unit enum** (Q6), the
  **unique constraint** (Q8), and the **M:N** exercise↔muscle-group mapping (Q2).

---

## Still-open sub-details (block final approval)

All 10 main questions are resolved. Two sub-details remain open and must be answered before
final approval:

- [x] **S1 (from Q5) — PR comparison response shape.** For the week/month/year
  current-vs-previous comparison: return each period's three PRs (max weight, max volume,
  best 1RM — each with its achievement date) **side-by-side plus a computed delta**, or
  just the two period result sets without a delta?
  **RESOLVED — Option B: side-by-side plus a server-computed delta.** The compare response
  returns:
  - `current` and `previous` period blocks, each with `periodStart` / `periodEnd` (UTC) and
    the three PRs — `maxWeight`, `maxVolume`, `best1Rm` — each carrying its value and its own
    `achievedAt` date (plus contributing reps/weight where relevant).
  - A server-computed `delta` block with one entry per PR metric: `absolute`
    (current − previous), `percent`, and `direction` ("up" / "down" / "same").

  Edge cases to capture in acceptance criteria:
  - If a period has **no data**, that period's PR fields are `null` (empty-but-not-an-error,
    per spec).
  - A delta where `previous` is `null` cannot be a percentage — report `direction: "new"`
    with a `null` percent rather than dividing by zero.
  - All period boundaries are **UTC-based** (per Q3), computed from current time via the
    injected time context (per Q5).

- [x] **S2 (from Q6) — Output unit on reads.** Is the output unit a **per-request
  parameter**? What is its **default** (likely kg, the normalized unit)? And does it apply
  to **PR responses** as well as **history**?
  **RESOLVED — the output unit is a value the caller asks for.** Reads accept a per-request
  `unit` parameter (e.g. a query param); the API converts the stored normalized kg to that
  requested unit on output, reusing the **in-code unit registry** from Q6 (so adding a new
  output unit later is a minimal change). **Storage always stays normalized kg** — the
  converted value is for presentation only, never round-tripped into storage.

  _Confirmed micro-points:_
  - **M1 — RESOLVED: the `unit` parameter is REQUIRED on reads; there is NO default.** If the
    caller omits `unit` on a history or PR read, the API **raises a validation error
    (HTTP 400)** via the Joi request-validation layer — it does **not** silently assume kg.
  - **M2 — RESOLVED: yes, `unit` applies to BOTH history and PR responses.** Aggregations and
    the S1 comparison `delta` are computed on the normalized **kg** value and converted to the
    requested unit **only for display** (pick a display precision, e.g. 2 decimals; never
    store the converted value).
