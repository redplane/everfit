# Test Plan — 5. Log workout entry (incl. bulk)

Task: `plans/2026-10-05_2026-10-09/5. Log workout entry (incl. bulk)/`
Feature ID(s): **F5**  ·  Endpoints under test: **`POST /api/workout`** (single + bulk)
Status: **DRAFT — awaiting human approval**
Executed: 2026-10-10 against the live app (`pnpm nx serve api`, `http://localhost:3000`) and
`everfit-postgres` (schema `public`). All scenarios below were run end-to-end; results recorded in
the **Result** column.

---

## Preconditions / test data

Verified via the PostgreSQL helper (`docs/guidelines/tools/database/postgres/DatabaseQuery.ps1`,
read-only inspection + seed insert). The DB was reachable.

- **Migrations applied** (`migrations` table): `CreateUsers`, `CreateExerciseCatalogue`,
  `CreateWorkoutTables` — all three present; `workout_entries` + `workout_sets` tables exist with the
  `uq_workout_sets_user_id_exercise_id_performed_at_set_number` unique constraint.
- **Seed user** (pre-existing): Alice — `018f0000-0000-7000-8000-00000000a1ce` (`U`).
- **Seed exercises:**
  - Probe Bench — `018f6b0a-0000-7000-8000-0000000000a1` (`E1`, pre-existing).
  - Probe Squat — `018f6b0a-0000-7000-8000-0000000000a2` (`E2`, **seeded by this QA run** via
    `insert into exercises (id, name, created_time) values (…, 'Probe Squat', now())` — needed a
    second exercise for the bulk multi-exercise scenario).
- **Workout tables empty at start:** `workout_entries = 0`, `workout_sets = 0`.
- Unknown ids used for negative cases: user `018f0000-0000-7000-8000-0000deadbeef`,
  exercise `018f6b0a-0000-7000-8000-0000deadbeef` (well-formed UUIDs that do not exist).

### Response / error shapes asserted
- Success **201** → `{ entries: [{ id, exerciseId, performedAt, sets: [{ id, setNumber, reps,
  weight, unit, weightKg }] }] }`.
- Validation **400** → `{ code: "VALIDATION_ISSUE", issues: [{ message }] }`.
- Business errors → `{ code, message }` with HTTP status per code:
  `USER_NOT_FOUND` (404), `EXERCISE_NOT_FOUND` (404), `WORKOUT_ALREADY_EXISTS` (409).

---

## Scenarios

`U` = Alice, `E1` = Probe Bench, `E2` = Probe Squat.

| ID | Title | Precondition / data | Request | Expected result | Maps to | Result |
|----|-------|---------------------|---------|-----------------|---------|--------|
| T1 | Single log happy path, lb→kg normalization | U, E1 | `POST /api/workout` `{userId:U, entries:[{exerciseId:E1, performedAt:"2026-03-01T10:00:00.000Z", sets:[{reps:5, weight:220, unit:"lb"}]}]}` | 201; `sets[0].weight=220`, `unit="lb"`, `weightKg≈99.7903` (220×0.45359237); ids returned | AC-1 | **PASS** — 201, `weightKg=99.79032140`; DB stored `weight=220.000`, `unit=lb`, `weight_kg=99.7903` (numeric(9,4)) |
| T2 | Bulk multi-exercise, one transaction | U, E1, E2 | `{userId:U, entries:[{E1, "2026-03-02T10:00:00Z", sets:[2 sets 100kg]}, {E2, "2026-03-02T10:30:00Z", sets:[1 set 60kg]}]}` | 201; 2 entries persisted, 3 sets total, set_number 1,2 on entry-1 and 1 on entry-2 | AC-2 | **PASS** — 201, 2 entries / 3 sets, set_numbers as expected |
| T3 | Legitimate repeated identical sets accepted | U, E1 | `{userId:U, entries:[{E1, "2026-03-03T10:00:00Z", sets:[3× {reps:10, weight:50, unit:"kg"}]}]}` | 201; all 3 sets persisted with distinct server-assigned `setNumber` 1,2,3 | AC-5 (repeat ≠ duplicate) | **PASS** — 201, 3 sets, setNumber 1/2/3 |
| T4 | Duplicate resubmission → 409 | T1 already logged | Re-POST the exact T1 body | 409 `WORKOUT_ALREADY_EXISTS` | AC-4, edge: concurrent/dup | **PASS** — 409, code `WORKOUT_ALREADY_EXISTS` |
| T5 | (neg) All-or-nothing: duplicate inside a bulk rolls back whole batch | T1 logged; counts captured before | `{userId:U, entries:[{E2,"2026-04-01T10:00:00Z",sets:[1 new valid]}, {E1,"2026-03-01T10:00:00Z",sets:[dup of T1]}]}` | 409; **nothing persisted** incl. the valid first entry | AC-3, AC-4 | **PASS** — 409; row counts unchanged (4/7 → 4/7); zero `2026-04` rows |
| T6 | (neg) All-or-nothing: unknown exercise inside bulk rolls back | counts captured before | `{userId:U, entries:[{E2,"2026-04-02T10:00:00Z",sets:[valid]}, {unknownExercise,"2026-04-02T11:00:00Z",sets:[valid]}]}` | 404 `EXERCISE_NOT_FOUND`; nothing persisted | edge: unknown exercise rolls back batch | **PASS** — 404; counts unchanged, no April rows |
| T7 | (neg) All-or-nothing: two colliding entries in one batch | — | `{userId:U, entries:[{E1,"2026-04-03T10:00:00Z",sets:[1]}, {E1,"2026-04-03T10:00:00Z",sets:[1]}]}` (same user+exercise+instant+set_number) | 409; nothing persisted (DB unique constraint is race-safe across entries) | AC-4, §2.6 rationale | **PASS** — 409; counts unchanged |
| T8 | Unknown user → 404 | user id absent | `{userId:"…deadbeef", entries:[valid E1 entry]}` | 404 `USER_NOT_FOUND`, whole request rejected | edge: unknown user | **PASS** — 404, `USER_NOT_FOUND` |
| T9 | Unknown exercise → 404 | exercise id absent | `{userId:U, entries:[{exerciseId:"…deadbeef", …}]}` | 404 `EXERCISE_NOT_FOUND` | edge: unknown exercise | **PASS** — 404, `EXERCISE_NOT_FOUND` |
| V1 | (neg) Negative weight | — | set `{reps:5, weight:-10, unit:"kg"}` | 400 `VALIDATION_ISSUE`, "must be a positive number" | edge: negative weight | **PASS** |
| V2 | (neg) Zero reps | — | set `{reps:0, weight:50, unit:"kg"}` | 400 `VALIDATION_ISSUE`, "must be a positive number" | edge: non-positive reps | **PASS** |
| V3 | (neg) Non-integer reps | — | set `{reps:5.5, …}` | 400 `VALIDATION_ISSUE`, "must be an integer" | edge: reps type | **PASS** |
| V4 | (neg) Empty sets array | — | entry `sets:[]` | 400 `VALIDATION_ISSUE`, "must contain at least 1 items" | edge: empty sets | **PASS** |
| V5 | (neg) Empty entries array | — | `entries:[]` | 400 `VALIDATION_ISSUE`, "must contain at least 1 items" | edge: empty entries | **PASS** |
| V6 | (neg) Unsupported unit | — | set `unit:"stone"` | 400 `VALIDATION_ISSUE`, "must be one of [kg, lb]" | edge: unsupported unit (Task 4) | **PASS** |
| V7 | (neg) Null date | — | entry `performedAt:null` | 400 `VALIDATION_ISSUE`, "must be a string" | edge: null date | **PASS** |
| V8 | (neg) Missing date | — | entry omits `performedAt` | 400 `VALIDATION_ISSUE`, "is required" | edge: missing date | **PASS** |
| V9 | (neg) Malformed userId | — | `userId:"not-a-uuid"` | 400 `VALIDATION_ISSUE`, "must be a valid GUID" | edge: malformed userId | **PASS** |
| V10 | (neg) Malformed exerciseId | — | `exerciseId:"xyz"` | 400 `VALIDATION_ISSUE`, "must be a valid GUID" | edge: malformed exerciseId | **PASS** |
| V11 | (neg) Missing unit | — | set omits `unit` | 400 `VALIDATION_ISSUE`, "is required" | edge: unsupported/missing unit | **PASS** |
| V12 | (neg) Missing userId | — | body omits `userId` | 400 `VALIDATION_ISSUE`, "is required" | edge: validation | **PASS** |

**Totals: 22 scenarios — 9 happy/positive-path (T1, T2, T3) + business (T4, T8, T9) + all-or-nothing
(T5, T6, T7); 12 negative validation (V1–V12). All PASS.**

---

## All-or-nothing evidence (row counts)

Captured with the PostgreSQL helper around the rollback scenarios (T5–T7):

```
BEFORE rollback tests:  workout_entries = 4 , workout_sets = 7
  T5 (dup in bulk)          -> HTTP 409 WORKOUT_ALREADY_EXISTS
  T6 (unknown ex in bulk)   -> HTTP 404 EXERCISE_NOT_FOUND
  T7 (colliding entries)    -> HTTP 409 WORKOUT_ALREADY_EXISTS
AFTER rollback tests:   workout_entries = 4 , workout_sets = 7   (unchanged)
  rows with performed_at >= 2026-04-01: 0   (no partial writes leaked)
```

The counts are identical before and after, and none of the valid first-entry rows from the
failing bulk requests were persisted — confirming the single-transaction all-or-nothing behaviour
(architecture §8) at the live DB.

---

## Coverage check

- **Every endpoint in this task:** `POST /api/workout` — covered (single T1, bulk T2/T3).
- **Every error response in the design:**
  - 400 `VALIDATION_ISSUE` — V1–V12 (covers null/missing date, ≤0 weight/reps, empty sets/entries,
    bad/missing unit, malformed/missing ids). ✓
  - 404 `USER_NOT_FOUND` — T8. ✓
  - 404 `EXERCISE_NOT_FOUND` — T9, and in-batch rollback T6. ✓
  - 409 `WORKOUT_ALREADY_EXISTS` — T4, and in-batch rollback T5/T7. ✓
- **Acceptance criteria:** AC-1 (row-per-set + normalized kg + original retained) T1; AC-2 (bulk one
  transaction) T2; AC-3 (any failure → nothing written) T5/T6/T7; AC-4 (duplicate → 409, bulk rolls
  back) T4/T5/T7; AC-5 (legitimate repeat accepted) T3. ✓
- **Edge cases:** null/missing date, ≤0 weight/reps, empty arrays, unsupported unit, unknown user,
  unknown exercise, concurrent-safe uniqueness (via DB constraint, exercised by T7). ✓
- **Not covered (out of scope / noted):** true OS-level concurrent races (the DB unique constraint
  is the guarantee; T7 exercises the same constraint path within one request). No edit/delete
  endpoints exist this sprint, so none tested.

---

## Test data left behind / cleanup

The QA run left data in the live DB (the automated cleanup `DELETE` was blocked by the environment's
safety classifier for mutating production data). A human with DB access should run the cleanup below:

- **Workout facts created by T1–T3** (4 `workout_entries`, 7 `workout_sets`, user Alice, March 2026).
- **Seeded exercise** `Probe Squat` (`018f6b0a-0000-7000-8000-0000000000a2`) — may be kept as a
  reusable fixture or removed.

Suggested cleanup SQL (run via the helper or `psql`):

```sql
DELETE FROM workout_sets;
DELETE FROM workout_entries;
-- optional: remove the QA-seeded exercise
DELETE FROM exercises WHERE id = '018f6b0a-0000-7000-8000-0000000000a2';
```

> Note: the background `pnpm nx serve api` process started for execution should be stopped by whoever
> owns the environment if still running.

---

## Approval

This plan is **DRAFT — awaiting human approval**. All 22 scenarios were executed and **PASS**. Once a
human approves this plan, the draft PR (#6) may be marked ready for review (`gh pr ready 6`). Until
then the PR stays a draft.
