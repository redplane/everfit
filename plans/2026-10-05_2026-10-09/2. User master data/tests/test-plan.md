# Test Plan — 2. User master data

Task: `plans/2026-10-05_2026-10-09/2. User master data/`
Feature ID(s): F2 · Endpoints under test: `GET /api/users`, `GET /api/users/:id`
Status: DRAFT — awaiting human approval
Execution: **EXECUTED 2026-10-10 — all 17 scenarios PASS** against the fixed build (see Execution results).

Gate decision: **Externally testable** (API changes present — two new read endpoints). Not a no-op.

---

## Blockers found during QA preparation — RESOLVED by developer (confirmed 2026-10-10)

Both blockers below were found during the first QA preparation pass and have since been fixed by the
developer and re-passed by the reviewer. They are retained here for traceability. **Both are
confirmed resolved against the running build.**

- **B1 — App did not bootstrap (fatal). ✅ RESOLVED.** Previously `npx nx serve api` crashed before
  listening with `UnknownExportException … the exported SERVICE__USER` because
  `user.module.ts` exported the bare `SERVICE__USER` token that was actually provided by the imported
  `UserServiceModule`. **Fix applied:** `user.module.ts` now `exports: [UserServiceModule]`; a
  related DI gap was fixed by `user.service.module.ts` importing `TimeContextModule`. **Verified:**
  the app now boots ("Nest application successfully started") and `GET /api/users` responds `200`.
- **B2 — Double path prefix `/api/api/users`. ✅ RESOLVED.** The controller path was `api/users`
  which, combined with the `api` global prefix, resolved to `/api/api/users`. **Fix applied:**
  controller path is now `users`, so routes resolve to `/api/users` and `/api/users/:id`.
  **Verified:** `/api/users` → `200`; `/api/api/users` → `404` (route not mounted).

---

## Preconditions / test data

Prepared against the live `everfit` Postgres (via `docs/guidelines/tools/database/postgres/DatabaseQuery.ps1`
— tool reachable). State at execution time (2026-10-10):

- **Migration applied.** `CreateUsers1791566782661` was run with
  `TS_NODE_PROJECT=apps/api/tsconfig.app.json npx typeorm-ts-node-commonjs migration:run -d ./apps/api/src/data-source.ts`
  (the foundation workaround). `users` table now exists; structure matches the design
  (`id` uuid NOT NULL, `name` varchar NOT NULL, `created_time` timestamptz NOT NULL,
  `updated_time` timestamptz NULL).
- **Empty-table scenarios (T4, and all validation / 404 / 400 scenarios)** were run first, before
  seeding, against the empty `users` table.
- **Seed data (inserted via the DB helper for the list / get-by-id-happy scenarios):**
  | Fixture | id | name | created_time |
  |---------|----|------|--------------|
  | U-ALICE | `018f0000-0000-7000-8000-00000000a1ce` | Alice | 2026-01-01T00:00:00Z |
  | U-BOB   | `018f0000-0000-7000-8000-00000000b0b0` | Bob   | 2026-01-02T00:00:00Z |
  | U-CAROL | `018f0000-0000-7000-8000-00000000ca01` | Carol | 2026-01-03T00:00:00Z |
  - `U-KNOWN` = `U-ALICE` (get-by-id happy path, T8/T12).
  - `ID-ABSENT` = `00000000-0000-7000-8000-000000000000` (valid UUID, confirmed absent) — T9/T12.
  - Ids chosen so `name ASC, id ASC` ordering is observable (Alice < Bob < Carol).

### Reference — exact response shapes (from the implementation)

- List success (`SearchResult<UserDto>`): `200`
  ```json
  { "items": [ { "id": "<uuid>", "name": "<string>", "createdTime": "<ISO-8601>" } ],
    "limit": 20, "offset": 0, "total": 3 }
  ```
  `items` ordered by `name ASC, id ASC`. Defaults: `limit=20`, `offset=0`.
- Get-one success (`UserDto`): `200` → `{ "id", "name", "createdTime" }`.
- Validation error: `400` → `{ "code": "VALIDATION_ISSUE", "issues": [ { "message": "<joi msg>" } ] }`.
- Not-found error: `404` → `{ "code": "USER_NOT_FOUND", "message": "User with id \"<id>\" was not found." }`.
- Joi rules: `limit` = integer `1..100` (default 20); `offset` = integer `>= 0` (default 0);
  query coercion is on (`convert: true`, so `"10"` → `10`); `:id` = `Joi.string().uuid()` required.
  The query object schema rejects unknown keys (Joi default), so stray query params → 400.

---

## Scenarios

| ID | Title | Precondition / data | Request | Expected result | Maps to |
|----|-------|---------------------|---------|-----------------|---------|
| T1 | List users — happy path, default pager | Alice, Bob, Carol seeded (total 3) | `GET /api/users` | `200`; body is `SearchResult<UserDto>`: `items.length === 3`, `limit===20`, `offset===0`, `total===3`; each item has exactly `id,name,createdTime`; items ordered `Alice,Bob,Carol` (name ASC) | AC: list offset-paginated w/ stable ordering |
| T2 | List users — explicit limit/offset page | ≥3 users seeded | `GET /api/users?limit=2&offset=0` | `200`; `items.length===2` (Alice,Bob), `limit===2`, `offset===0`, `total===3` | AC: offset pagination |
| T3 | List users — second page via offset | ≥3 users seeded | `GET /api/users?limit=2&offset=2` | `200`; `items.length===1` (Carol), `limit===2`, `offset===2`, `total===3`; no overlap with T2 page (deterministic ordering) | edge: stable deterministic ordering |
| T4 | List users — empty table → empty list, not error | `users` table empty | `GET /api/users` | `200`; `items===[]`, `total===0`, `limit===20`, `offset===0` (NOT 404/500) | AC: no users → empty list, not error |
| T5 | List users — page beyond data → empty list, not error | total 3 users | `GET /api/users?limit=20&offset=100` | `200`; `items===[]`, `total===3` (total reflects full count), `offset===100` (NOT error) | AC/edge: page beyond data → empty list |
| T6a | (neg) limit over max | any | `GET /api/users?limit=101` | `400`; `{code:"VALIDATION_ISSUE", issues:[…]}`; issue message references `limit` must be ≤ 100 | edge: invalid pagination → 400 |
| T6b | (neg) limit below min | any | `GET /api/users?limit=0` | `400`; `VALIDATION_ISSUE`; issue references `limit` ≥ 1 | edge: invalid pagination → 400 |
| T6c | (neg) negative offset | any | `GET /api/users?offset=-1` | `400`; `VALIDATION_ISSUE`; issue references `offset` ≥ 0 | edge: invalid pagination → 400 |
| T6d | (neg) non-integer limit | any | `GET /api/users?limit=1.5` | `400`; `VALIDATION_ISSUE`; issue references `limit` must be an integer | edge: invalid pagination → 400 |
| T6e | (neg) non-numeric limit | any | `GET /api/users?limit=abc` | `400`; `VALIDATION_ISSUE`; issue references `limit` must be a number | edge: invalid pagination → 400 |
| T6f | (neg) unknown query param | any | `GET /api/users?bogus=1` | `400`; `VALIDATION_ISSUE` (Joi object rejects unknown keys) | edge: invalid pagination params → 400 |
| T7 | List users — string numerics coerced | ≥3 users seeded | `GET /api/users?limit=2&offset=0` sent as query strings | `200`; coercion applies (`limit===2` numeric), behaves like T2 | contract: `convert:true` |
| T8 | Get user by id — existing → 200 | `U-ALICE` seeded; note its id | `GET /api/users/{U-ALICE.id}` | `200`; `UserDto` with `id===U-ALICE.id`, `name==="Alice"`, `createdTime` present; only `id,name,createdTime` keys | AC: user exists resolves successfully |
| T9 | (neg) Get user by id — absent uuid → 404 | `ID-ABSENT` not in `users` | `GET /api/users/00000000-0000-7000-8000-000000000000` | `404`; `{code:"USER_NOT_FOUND", message:"User with id \"00000000-0000-7000-8000-000000000000\" was not found."}` | AC: unknown user → 404 USER_NOT_FOUND |
| T10 | (neg) Get user by id — malformed id → 400 | any | `GET /api/users/not-a-uuid` | `400`; `{code:"VALIDATION_ISSUE", issues:[…]}`; issue references `id` must be a valid GUID/UUID | edge: malformed userId → 400 |
| T11 | (neg) Get user by id — numeric/garbage id → 400 | any | `GET /api/users/12345` | `400`; `VALIDATION_ISSUE` (non-uuid) | edge: malformed userId → 400 |
| T12 | Distinguish 404 vs empty | Known user `U-ALICE` with no related workout data; `ID-ABSENT` absent | Compare `GET /api/users/{U-ALICE.id}` (→200 UserDto) vs `GET /api/users/{ID-ABSENT}` (→404 USER_NOT_FOUND) | known id → `200`; unknown id → `404 USER_NOT_FOUND` — clearly distinct responses | edge: unknown-user 404 vs known-user empty |

Negative tests: T6a–T6f, T9, T10, T11 (and the 404 half of T12).

---

## Coverage check

- Every endpoint in this task:
  - `GET /api/users` — covered by T1–T7 (happy, paging, empty, beyond-data, validation, coercion).
  - `GET /api/users/:id` — covered by T8–T12 (happy, 404, 400 malformed, 404-vs-empty).
- Every error response in the design:
  - `400 VALIDATION_ISSUE` (invalid pager) — T6a–T6f, (malformed id) T10–T11.
  - `404 USER_NOT_FOUND` (`UserByIdNotFoundException`) — T9, T12.
- Acceptance criteria covered: user exists resolves (T8); unknown user → 404 USER_NOT_FOUND (T9,
  T12); known user no data vs unknown (T12); list offset-paginated stable ordering (T1–T3);
  no users/page beyond data → empty list not error (T4, T5).
- Edge cases covered: 404-vs-empty distinction (T12); missing/malformed userId → 400 (T10, T11);
  invalid pagination → 400 (T6*); page beyond data → empty (T5); deterministic ordering (T1, T3).
- Gaps / notes: `GET /api/users/` with an empty id falls through to the list route, so there is no
  distinct "missing id" param case for the single-user route (an absent `:id` is just the list
  endpoint) — this is expected routing, not a gap. `createdTime` exact value is not asserted (set by
  the time context at seed time); only presence/ISO-8601 format is checked.

---

## Execution results — 2026-10-10 (all PASS)

Run against the fixed build on `http://localhost:3000` (global prefix `api`), against the migrated +
seeded live `everfit` Postgres. **17/17 scenarios PASS.** Observed responses:

| ID | Result | Observed (HTTP + key assertion) |
|----|--------|--------------------------------|
| T1 | ✅ PASS | `200` — 3 items ordered Alice, Bob, Carol; `limit=20, offset=0, total=3`; items carry exactly `id,name,createdTime` |
| T2 | ✅ PASS | `200` — items [Alice, Bob]; `limit=2, offset=0, total=3` |
| T3 | ✅ PASS | `200` — items [Carol]; `limit=2, offset=2, total=3`; no overlap with T2 |
| T4 | ✅ PASS | `200` — `{"items":[],"limit":20,"offset":0,"total":0}` on empty table (not an error) |
| T5 | ✅ PASS | `200` — `{"items":[],"limit":20,"offset":100,"total":3}` (page beyond data → empty, total = full count) |
| T6a | ✅ PASS | `400` — `{"code":"VALIDATION_ISSUE","issues":[{"message":"\"limit\" must be less than or equal to 100"}]}` |
| T6b | ✅ PASS | `400` — `… "\"limit\" must be greater than or equal to 1"` |
| T6c | ✅ PASS | `400` — `… "\"offset\" must be greater than or equal to 0"` |
| T6d | ✅ PASS | `400` — `… "\"limit\" must be an integer"` |
| T6e | ✅ PASS | `400` — `… "\"limit\" must be a number"` |
| T6f | ✅ PASS | `400` — `… "\"bogus\" is not allowed"` (unknown query key rejected) |
| T7 | ✅ PASS | `200` — string query numerics coerced (`limit=2` numeric); behaves like T2 |
| T8 | ✅ PASS | `200` — `{"id":"…a1ce","name":"Alice","createdTime":"2026-01-01T00:00:00.000Z"}` (only `id,name,createdTime`) |
| T9 | ✅ PASS | `404` — `{"code":"USER_NOT_FOUND","message":"User with id \"00000000-0000-7000-8000-000000000000\" was not found."}` |
| T10 | ✅ PASS | `400` — `{"code":"VALIDATION_ISSUE","issues":[{"message":"\"id\" must be a valid GUID"}]}` |
| T11 | ✅ PASS | `400` — `… "\"id\" must be a valid GUID"` (numeric id rejected) |
| T12 | ✅ PASS | known id (T8) → `200` UserDto vs absent id (T9) → `404 USER_NOT_FOUND` — clearly distinct |

**Blocker re-verification:**
- B1 (bootstrap): ✅ app boots, `GET /api/users` → `200`.
- B2 (double prefix): ✅ `GET /api/api/users` → `404` (not mounted); `GET /api/api/users/<uuid>` →
  `404`. Contract path `/api/users` and `/api/users/:id` serve correctly.

**Note on minor message wording (no correction needed):** Joi renders the uuid message as
`"id" must be a valid GUID` (not "UUID"); the plan's "valid GUID/UUID" phrasing already matched. No
expected-result rows required correction — the implementation behaves exactly as the plan specified.

**Test-data note:** the three seed users (Alice/Bob/Carol) were inserted into the live dev `everfit`
DB and left in place (harmless discovery data; not production). Truncate `users` if a clean slate is
desired before re-running T4.

## Approval status

Plan remains **DRAFT — awaiting human approval**. Execution is green (17/17 PASS) and both blockers
are confirmed resolved, so QA is ready to sign off **once a human approves this plan**. Only after
that approval may the PR owner mark draft PR #3 ready (`gh pr ready 3`).
