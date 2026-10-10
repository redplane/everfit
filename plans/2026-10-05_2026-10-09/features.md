# Everfit Workout Logging API — Product Backlog (features)

Source of truth: `docs/requirement.md` and the approved
`plans/2026-10-05_2026-10-09/goal.md` (all open questions resolved & approved 2026-10-09).

This file is the **WHAT** (product scope). It contains no endpoint paths, DTO shapes, entity
columns, or file layout — those belong to the architect (`plans/<sprint>/architecture.md` and each
task's `architecture-design.md`).

## Global assumptions & out-of-scope (apply to every feature)

- **No authentication / authorization.** `userId` is passed as a parameter; the API trusts it
  (but still validates the user *exists* — see F2).
- **Platform:** NestJS (Node 22 / TS 5) in the existing Nx monorepo; **PostgreSQL + TypeORM**;
  **Joi** for request validation; global exception filter; module-per-feature layout — per
  `docs/guidelines` (these conventions override defaults).
- **Time is UTC everywhere.** Workout date/time stored as a UTC timestamp, independent of the
  DB/server timezone. All range filtering and period math operate in UTC. No static `now` — a
  time context is injected (`time-with-DI` convention).
- **Weights stored normalized in kg** alongside the original value + unit. Conversion uses an
  in-code unit registry (F4); converted output values are presentation-only and never stored.
- **Empty vs error distinction:** a *known* user with no data matching a filter returns an
  **empty result, not an error**. An *unknown* user returns **404** (see F2/F5/F6/F7).
- **Out of scope for the whole product:** authN/authZ, coach↔client relationship management,
  workout program/plan authoring, scheduling/notifications, any UI/front-end. The
  `AI_WORKFLOW.md` and video deliverables are owned outside this backlog (scribe agent).

---

## F1 — Platform foundation (error handling, validation, time context, config, API docs)

Cross-cutting enabling capability every other feature builds on.

**User story:** As an engineer, I want a consistent error-handling, request-validation, time, and
configuration foundation so that every endpoint behaves predictably and failures are structured and
meaningful.

**Acceptance criteria**
- Given any request that fails validation, When it is handled, Then the API returns a structured
  **400** error body with a stable application error code and a meaningful message (Joi-based).
- Given any unhandled or domain error, When it occurs, Then a global exception filter translates it
  into a structured error body with a stable application error code — never a raw stack trace.
- Given business code needs the current time, When it asks, Then it receives it from an injected
  time context (UTC), not `new Date()` / `Date.now()`.
- Given configuration/secrets, When the app boots, Then they are read via layered config (no
  hardcoded secrets); API documentation is gated by an environment variable (default off).

**Edge cases & error handling**
- Malformed JSON / wrong content type → structured 400, not a crash.
- Unknown route → consistent structured 404 shape.

**Out of scope / assumptions:** no auth middleware; concrete error-code catalogue and filter wiring
are the architect's.

**Priority:** Must. **Depends on:** none.

---

## F2 — User master data & existence validation

**User story:** As a coach, I want users to be real, known records so that logging and reads are
tied to an actual client and an unknown `userId` is reported clearly rather than silently returning
nothing.

**Acceptance criteria**
- Given a user exists, When any feature references that `userId`, Then the reference resolves.
- Given a `userId` that does not exist, When a read (history / PR / comparison) is requested, Then
  the API returns **404** with the stable error code `USER_NOT_FOUND`.
- Given a `userId` that does not exist, When a workout log is attempted, Then the request is
  rejected (not-found), consistent with F5's all-or-nothing rule.
- Given a known user with no workout data, When data is read, Then the result is an **empty
  result, not an error** (distinct from the 404 above).
- Given users exist, When a **list users** request is made, Then they are returned
  **offset-paginated** (small master-data list) with a stable ordering, so a caller can discover
  valid `userId`s to use on reads and logging.
- Given no users exist, or the requested page is beyond the data, When list users is requested,
  Then an **empty list** is returned (not an error).

**Edge cases & error handling**
- Distinguish "unknown user → 404" from "known user, no matching data → empty result".
- Missing/malformed `userId` parameter → 400 validation error.
- List users: invalid pagination parameters → 400; a page beyond the data → empty list (not an
  error); a stable, deterministic ordering is applied.

**Out of scope / assumptions:** no user profile management beyond the minimal master record needed
to validate existence and support discovery; no auth. Managed as master data (seedable via F9).

**Priority:** Must (existence validation) with a **Should** list-users discovery capability.
**Depends on:** F1.

---

## F3 — Exercise & muscle-group master data + mapping

**User story:** As a coach, I want exercises and muscle groups to be managed, configurable master
data with a mapping between them so that workout logs reference real exercises and history can be
filtered by muscle group without hardcoded logic.

**Acceptance criteria**
- Given the catalogue, When a workout is logged, Then it references an **existing exercise**
  (not free-text create-on-first-use).
- Given an exercise, When its muscle groups are needed, Then they are resolved via a configurable
  **many-to-many** mapping (one exercise may map to multiple muscle groups and vice versa).
- Given a mapping already exists for an (exercise, muscle group) pair, When the same pair is added
  again, Then it is rejected/ignored — the pair is **unique**.
- Given a muscle-group filter on history, When applied, Then only exercises mapped to that muscle
  group are matched.
- Given exercises exist, When a **list exercises** request is made, Then they are returned
  **offset-paginated** with a stable ordering, each including its mapped muscle group(s) where
  relevant, so a caller can pick a valid exercise to log or filter by. An optional **partial-name
  filter** may narrow the list.
- Given muscle groups exist, When a **list muscle groups** request is made, Then they are returned
  **offset-paginated** with a stable ordering, so a caller can discover valid values for the history
  muscle-group filter.
- Given no exercises / muscle groups exist, or the requested page is beyond the data, When listed,
  Then an **empty list** is returned (not an error).

**Edge cases & error handling**
- Logging against a non-existent exercise → not-found error (see F5).
- Duplicate (exercise, muscle group) mapping → rejected via the uniqueness rule, not silently
  duplicated.
- The mapping is configuration-driven, not hardcoded in business logic (spec extensibility rule).
- List endpoints: invalid pagination parameters → 400; a page beyond the data → empty list (not an
  error); stable, deterministic ordering applied.

**Out of scope / assumptions:** no end-user CRUD UI for the catalogue (lists are read-only
discovery); mapping cardinality is M:N with a unique pair constraint (architect models the join).
Seedable via F9.

**Priority:** Must (master data + mapping) with a **Should** list/discovery capability.
**Depends on:** F1.

---

## F4 — Unit conversion registry (category-based, extensible)

**User story:** As an engineer, I want units and their conversions organized by **category** and
defined in one place in code so that storage stays normalized, conversions are only ever done within
a category, and adding a new unit — or a whole new category — later is a minimal, localized change.

**Acceptance criteria**
- Given units are organized by **category** (e.g. weight, length), When the registry is used, Then
  every unit belongs to exactly one category. This sprint only the **weight** category is used
  (units **kg** and **lb**), but the model is category-aware.
- Given each unit, When it is defined, Then it carries a **stable code** (the value used on the
  wire, e.g. `"kg"` / `"lb"`), a **name**, and a **description**.
- Given a weight in a supported unit (kg or lb), When it is logged, Then the system stores the
  original value + unit **and** the normalized value (kg for the weight category).
- Given a stored normalized value and a requested output unit, When a read returns it, Then it is
  converted to the requested unit **for display only** (never re-stored).
- Given two units, When a conversion is requested, Then it is only valid **between units of the same
  category**; converting across categories (e.g. weight ↔ length) is an **error**.
- Given a new unit is added to an existing category, or a whole new category is added later, When it
  is introduced, Then it requires only a minimal, localized config-or-code change — no scattered
  conditional logic.
- Given an unsupported/invalid unit, When supplied anywhere, Then the request is rejected with a
  structured validation error.

**Edge cases & error handling**
- Invalid or unsupported unit on input or output → 400.
- A cross-category conversion request → error (never silently coerced).
- Conversion rounding/precision for display is defined consistently (e.g. 2 decimals).

**Out of scope / assumptions:** only the weight category (kg + lb) ships this sprint; length and
other categories, and units like stone, are the extensibility examples the model must accommodate
without rework. The registry lives in code (not DB), per the resolved decision. The concrete unit
representation and conversion service are the architect's.

**Priority:** Must. **Depends on:** F1.

---

## F5 — Log a workout entry (including bulk)

**User story:** As a coach, I want to log a client's workout — one or many exercises at once, each
with its sets — so that their training is recorded accurately and efficiently.

**Acceptance criteria**
- Given a valid log request for a known user and existing exercise(s), When submitted, Then each
  **set is stored as its own record** (row-per-set) with reps, weight, original unit, normalized
  kg, and a UTC timestamp.
- Given a request containing **multiple exercises** (bulk), When submitted, Then all of them are
  logged in a **single atomic transaction**.
- Given any entry/set in a (single or bulk) request fails validation or persistence, When
  processed, Then the **entire request is rejected and nothing is written** (all-or-nothing), with
  a structured error identifying the problem(s).
- Given a duplicate set would violate the uniqueness rule, When submitted, Then the API returns a
  structured **409** conflict (and, within a bulk request, the whole batch rolls back).
- Given two legitimately identical sets (same reps/weight) that are *not* true duplicates, When
  logged, Then both are accepted (the uniqueness key distinguishes real repeats from duplicates).

**Edge cases & error handling**
- Null/missing date, negative or zero weight/reps, empty sets array → 400 validation error.
- Invalid/unsupported unit → 400 (via F4).
- Unknown user → not-found; unknown exercise → not-found; both roll back the batch.
- Concurrent writes of the same set → DB unique constraint makes it race-safe → 409 for the loser.

**Out of scope / assumptions:** no edit/delete of logged workouts this sprint (unless added later);
the uniqueness key granularity (e.g. precise timestamp and/or set ordinal) is the architect's.

**Priority:** Must. **Depends on:** F2, F3, F4.

---

## F6 — Get workout history

**User story:** As a coach, I want to retrieve a client's logged workouts, filtered and paginated,
in the unit I ask for, so that I can review their training over time.

**Acceptance criteria**
- Given a known user, When history is requested, Then matching workout records are returned,
  **cursor-paginated** (keyset), stable under concurrent inserts and performant at 50k+ entries.
- Given an **exercise-name** filter, When applied, Then it matches by **partial** name.
- Given a **date-range** filter, When applied, Then only records within the UTC range are returned.
- Given a **muscle-group** filter, When applied, Then only records whose exercise maps to that
  muscle group are returned (via F3).
- Given a **required `unit`** parameter, When supplied, Then weights are returned converted to that
  unit (display-only; storage stays kg).
- Given the `unit` parameter is **omitted**, When the request is made, Then the API returns a
  **400** validation error (no default unit).
- Given a known user with no matching records, When requested, Then an **empty result** is returned
  (not an error).
- Given an unknown user, When requested, Then **404 `USER_NOT_FOUND`**.

**Edge cases & error handling**
- Empty date range / no data → empty paginated result, not an error.
- Invalid cursor, invalid/unsupported unit, bad date format → 400.
- Large datasets (50k+) must remain performant (index-backed; architect owns indexing).

**Out of scope / assumptions:** offset pagination is reserved for master-data lists, not history.

**Priority:** Must. **Depends on:** F2, F3, F4, F5.

---

## F7 — Personal records (PRs)

**User story:** As a coach, I want a client's personal records for a given exercise so that I can
see their best performances and when they happened.

**Acceptance criteria**
- Given a known user and exercise, When PRs are requested, Then the API returns the **heaviest
  single set (max weight)**, the **highest-volume set (reps × weight)**, and the **best estimated
  1RM** using the Epley formula `weight × (1 + reps/30)`.
- Given each PR, When returned, Then it includes the **date it was achieved** (and the contributing
  reps/weight where relevant).
- Given a **required `unit`** parameter, When supplied, Then PR weights are returned in that unit
  (computed on normalized kg, converted for display only).
- Given the `unit` parameter is **omitted**, When requested, Then the API returns **400** (no
  default).
- Given a known user/exercise with no sets, When requested, Then PR fields are **empty/null**, not
  an error.
- Given an unknown user, When requested, Then **404 `USER_NOT_FOUND`**.

**Edge cases & error handling**
- No data → null/empty PRs (not an error).
- Aggregations computed on normalized kg; display converted via F4.
- Must be efficient at 50k+ entries (index-backed aggregation; architect owns indexing).

**Out of scope / assumptions:** 1RM uses Epley only (per spec). Other PR definitions out of scope.

**Priority:** Must. **Depends on:** F2, F4, F5.

---

## F8 — PR comparison across named periods

**User story:** As a coach, I want to compare a client's PRs between the current and previous period
(week / month / year) so that I can see progress trends at a glance.

**Acceptance criteria**
- Given a user, exercise, and a **granularity** (week / month / year), When comparison is
  requested, Then the API compares the **current period** against the **immediately preceding
  period** of that granularity.
- Given the periods, When returned, Then the response includes a `current` and `previous` block,
  each with its UTC period start/end and the three PRs (max weight, max volume, best 1RM), each with
  its value and `achievedAt` date.
- Given both periods have data, When returned, Then a server-computed `delta` block gives, per PR
  metric, the `absolute` difference (current − previous), `percent`, and `direction`
  ("up" / "down" / "same").
- Given a period has no data, When returned, Then that period's PR fields are **null**
  (empty-but-not-an-error).
- Given `previous` is null for a metric, When the delta is computed, Then it reports
  `direction: "new"` with a **null percent** (no divide-by-zero).
- Given a **required `unit`** parameter, When supplied, Then all displayed weights are in that unit
  (delta computed on kg, converted for display only); omission → **400**.
- Given an unknown user, When requested, Then **404 `USER_NOT_FOUND`**.

**Edge cases & error handling**
- Period boundaries are UTC-based, computed from the current time via the injected time context.
- No-data periods and null-previous deltas handled as above, never as errors.

**Out of scope / assumptions:** only named relative periods (not arbitrary date ranges) this sprint.

**Priority:** Should (high-value, builds directly on F7). **Depends on:** F7.

---

## F9 — Database CLI (reset + seed)

**User story:** As an engineer, I want a command-line tool to reset and re-seed the database,
including a large workout dataset, so that I can demonstrate correctness and query/aggregation
performance at scale.

**Acceptance criteria**
- Given the tool's **reset** operation, When run, Then the database is returned to a clean state
  (data dropped/truncated).
- Given the tool's **seed** operation, When run, Then it seeds master data (users, exercises,
  muscle groups and their mapping) **and** a large workout dataset of **50,000+** entries for a
  user.
- Given seeded data, When created, Then it respects all model rules: row-per-set, UTC timestamps,
  the kg/lb unit registry, the duplicate-uniqueness constraint, and the M:N exercise↔muscle-group
  mapping.

**Edge cases & error handling**
- Re-running seed must not violate the uniqueness constraints (idempotent or reset-first).
- Seeding 50k+ must complete in a reasonable time (bulk/batched inserts).

**Out of scope / assumptions:** concrete mechanism (Nx target / Nest standalone command) is the
architect/developer's choice; this is a dev tool, not an API endpoint.

**Priority:** Should (needed for the performance demo & video). **Depends on:** F2, F3, F4, F5.

---

## Priority summary (MoSCoW) & build order

| Order | Feature | Priority | Depends on |
|------|---------|----------|------------|
| 1 | F1 Platform foundation | Must | — |
| 2 | F2 User master data | Must | F1 |
| 3 | F3 Exercise & muscle-group master data | Must | F1 |
| 4 | F4 Unit conversion registry | Must | F1 |
| 5 | F5 Log workout (incl. bulk) | Must | F2, F3, F4 |
| 6 | F6 Workout history | Must | F2, F3, F4, F5 |
| 7 | F7 Personal records | Must | F2, F4, F5 |
| 8 | F8 PR comparison | Should | F7 |
| 9 | F9 Database CLI (reset + seed) | Should | F2, F3, F4, F5 |

Notes:
- F2, F3, F4 are independent of each other and can be built in parallel after F1.
- F6 and F7 both depend on F5 and are independent of each other (parallelizable).
- F8 extends F7. F9 can proceed any time after the data model (F5) and master data (F2/F3/F4) exist.
- **Read-only discovery lists** (list users in F2; list exercises + list muscle groups in F3) use
  **offset pagination** — the "offset for small master-data lists" half of the approved pagination
  decision (history uses cursor/keyset). These are Should-priority and support the Must features.

## Open questions

None — all open questions and sub-details are resolved and approved in
`plans/2026-10-05_2026-10-09/goal.md` (approved 2026-10-09).
