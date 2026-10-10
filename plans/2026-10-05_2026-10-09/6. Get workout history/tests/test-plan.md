# Test Plan — 6. Get workout history

Task: `plans/2026-10-05_2026-10-09/6. Get workout history/`
Feature ID(s): F6  ·  Endpoints under test: `GET /api/workout-history`
Status: DRAFT — awaiting human approval
Executed: 2026-10-10 against a local `nx serve api` on `http://localhost:3000`, backed by the live
`everfit-postgres` (schema migrated; 7 tables present). All scenarios **PASS**.

## Gate decision

Externally testable (NOT a no-op): the task adds a new HTTP endpoint
`GET /api/workout-history` (cursor/keyset-paginated; exercise partial-name, muscle-group and UTC
date-range filters; a **required** `unit` output-conversion param). A client can hit it and observe
the behaviour, so a black-box plan applies.

## Contract under test (from `architecture-design.md` + `architecture.md` §3/§6/§5)

- Query `GetWorkoutHistoryQueryDto`: `userId` (uuid, required), `unit` (required, `kg`/`lb`),
  `exerciseName?` (partial, trimmed), `muscleGroupId?` (uuid), `from?`/`to?` (ISO; `to ≥ from`),
  `cursor?` (opaque base64url), `limit` (int 1..100, default 20).
- 200 → `SearchResult<WorkoutHistoryItemDto>`: `{ items, limit, nextCursor }` (`nextCursor` null at
  end). Item = `{ entryId, exerciseId, exerciseName, performedAt, unit, sets[] }`;
  set = `{ setNumber, reps, weight (converted, 2 dp), originalWeight, originalUnit }`.
- Order: `performed_at DESC, id DESC`. Cursor encodes last-seen `(performedAt, id)` as base64url
  JSON `{p,i}`.
- Errors: 400 `VALIDATION_ISSUE` (missing/invalid `unit`, bad date, `to<from`, bad `limit`, bad
  `userId`/`muscleGroupId`, **invalid cursor** — INVALID_CURSOR is surfaced as a `ValidationException`
  so the wire code is `VALIDATION_ISSUE`); 404 `USER_NOT_FOUND` (unknown user); known user with no
  matching rows → **200 empty**, not an error.

## Preconditions / test data

Seeded/inspected read-only via `docs/guidelines/tools/database/postgres/DatabaseQuery.ps1` (psql +
pwsh on PATH; DB reachable). Reused the Task-5 QA seed and added a muscle-group mapping and a
same-`performed_at` tiebreak pair.

Users:
- Alice `018f0000-0000-7000-8000-00000000a1ce` — 4 entries over 3 UTC days (main pagination/filter
  subject).
- Bob `018f0000-0000-7000-8000-00000000b0b0` — 2 entries at the **same** instant (tiebreak subject).
- Carol `018f0000-0000-7000-8000-00000000ca01` — exists, **no** workout data (empty-result subject).
- Unknown user `018f0000-0000-7000-8000-000000000000` — not in `users` (404 subject).

Exercises / muscle groups:
- Probe Bench `018f6b0a-...-0000000000a1` → mapped to **QA Chest** `...-0000000000b1`.
- Probe Squat `018f6b0a-...-0000000000a2` → mapped to **QA Legs** `...-0000000000b2`.

Alice's entries (performed_at UTC → sets):
- `01a12477-895e...` 2026-03-03 10:00 Bench — 3×(10 reps, 50 kg)
- `01a12477-8927...` 2026-03-02 10:30 Squat — 1×(8 reps, 60 kg)
- `01a12477-891b...` 2026-03-02 10:00 Bench — 2×(5 reps, 100 kg)
- `01a12477-1897...` 2026-03-01 10:00 Bench — 1×(5 reps, 220 **lb** → 99.7903 kg stored)

Bob's tiebreak pair (both 2026-04-01 12:00:00Z; different exercises to satisfy the
`(user,exercise,performed_at,set_number)` unique constraint):
- `01a30000-...-0000000000e1` Bench, 1×(5, 80 kg)
- `01a30000-...-0000000000e2` Squat, 1×(5, 90 kg)

## Scenarios

| ID | Title | Precondition / data | Request | Expected result | Maps to | Result |
|----|-------|---------------------|---------|-----------------|---------|--------|
| T1 | Happy path — full history, default limit | Alice, 4 entries | `GET ?userId=<alice>&unit=kg` | 200; 4 items ordered 03-03, 03-02 10:30, 03-02 10:00, 03-01; `limit=20`; `nextCursor=null`; sets converted (220 lb entry → `weight=99.79`, `originalWeight=220`, `originalUnit=lb`) | AC "matching records returned, cursor-paginated"; unit conversion | PASS |
| T2 | Cursor page 1 (`limit=2`) | Alice | `GET ?userId=<alice>&unit=kg&limit=2` | 200; 2 items `[895e, 8927]`; `limit=2`; non-null `nextCursor` decoding to `{p:'2026-03-02T10:30:00.000Z', i:'...8927'}` | AC keyset pagination | PASS |
| T3 | Cursor page 2 via returned cursor | T2 cursor | `GET ?...&limit=2&cursor=<p1>` | 200; 2 items `[891b, 1897]`; **no overlap** with page 1; `nextCursor=null` (last page) | AC keyset; stable ordering | PASS |
| T4 | Last page → `nextCursor` null | 4 entries, limit 2 | page 2 result | `nextCursor=null`; union of pages = all 4 in DESC order, distinct | AC pagination end | PASS |
| T5 | Stable ordering — `id DESC` tiebreak | Bob, 2 entries same `performed_at` | `GET ?userId=<bob>&unit=kg` | 200; order `[...e2, ...e1]` (higher id first on equal `performed_at`) | AC "stable ordering"; §3 keyset | PASS |
| T6 | Exercise partial-name (ILIKE, case-insensitive) | Alice | `GET ?...&unit=kg&exerciseName=squat` | 200; only `Probe Squat` items | AC partial-name filter | PASS |
| T6b | Partial-name narrows to Bench | Alice | `exerciseName=bench` | 200; 3 items, all `Probe Bench` | AC partial-name | PASS |
| T6c | Partial-name matches both | Alice | `exerciseName=pro` | 200; 4 items (Bench+Squat) | AC partial-name | PASS |
| T7 | Muscle-group filter via join | QA Legs → Squat | `GET ?...&muscleGroupId=<legs>` | 200; only `Probe Squat` items | AC muscle-group filter | PASS |
| T7b | Muscle-group → Chest | QA Chest → Bench | `muscleGroupId=<chest>` | 200; 3 items, all `Probe Bench` | AC muscle-group filter | PASS |
| T8 | Date range (UTC) narrows | Alice | `from=2026-03-02T00:00:00Z&to=2026-03-02T23:59:59Z` | 200; only the two 03-02 entries | AC UTC date-range | PASS |
| T9 | Combined filters AND together | bench + Legs (disjoint) | `exerciseName=bench&muscleGroupId=<legs>` | 200; **0 items**; `nextCursor=null` (intersection empty, not an error) | AC filters AND; edge empty | PASS |
| T10 | (neg-ish) Filter matches nothing → empty 200 | Alice | `exerciseName=zzzznomatch` | **200** `{items:[],limit:20,nextCursor:null}` (not 4xx) | AC "no matching records → empty, not error" | PASS |
| T11 | Unit conversion kg→lb | Alice 03-03 (50 kg) | `unit=lb` | 200; `unit:'lb'`, set `weight=110.23`, `originalWeight=50`, `originalUnit='kg'` | AC required-unit conversion (50 kg → 110.23 lb) | PASS |
| T11b | Conversion round-trip lossless | Alice 03-01 (220 lb → 99.7903 kg) | `unit=lb` | 200; `weight=220`, `originalWeight=220`, `originalUnit='lb'` | AC conversion; originals retained | PASS |
| T12 | (neg) Missing `unit` → 400 | Alice | `GET ?userId=<alice>` | 400 `VALIDATION_ISSUE`, issue `"unit" is required` | AC "omit unit → 400, no default" | PASS |
| T13 | (neg) Unsupported `unit` → 400 | Alice | `unit=stone` | 400 `VALIDATION_ISSUE`, issue `"unit" must be one of [kg, lb]` | edge: invalid/unsupported unit | PASS |
| T14 | (neg) Unknown user → 404 | user not in `users` | `userId=<unknown>&unit=kg` | 404 `USER_NOT_FOUND` (`{code,message}`) | AC "unknown userId → 404 USER_NOT_FOUND" | PASS |
| T15 | Known user, no data → empty 200 | Carol | `userId=<carol>&unit=kg` | **200** `{items:[],limit:20,nextCursor:null}` | AC "known user no records → empty" | PASS |
| T16 | (neg) Malformed cursor → 400 | Alice | `cursor=not-a-valid-cursor` | 400 `VALIDATION_ISSUE`, issue `"cursor" is invalid or malformed` (INVALID_CURSOR surfaced as ValidationException) | edge: invalid cursor | PASS |
| T17 | (neg) `to < from` → 400 | Alice | `from=2026-03-05Z&to=2026-03-01Z` | 400 `VALIDATION_ISSUE`, issue `"to" must be greater than or equal to "ref:from"` | design cross-field rule | PASS |
| T18 | (neg) Bad date format → 400 | Alice | `from=not-a-date` | 400 `VALIDATION_ISSUE`, issue `"from" must be in ISO 8601 date format` | edge: bad date format | PASS |
| T19a | (neg) `limit=0` → 400 | Alice | `limit=0` | 400 `VALIDATION_ISSUE`, `"limit" must be greater than or equal to 1` | pagination bound | PASS |
| T19b | (neg) `limit=101` → 400 | Alice | `limit=101` | 400 `VALIDATION_ISSUE`, `"limit" must be less than or equal to 100` | pagination bound | PASS |
| T19c | `limit=100` boundary → 200 | Alice | `limit=100` | 200 | pagination bound | PASS |
| T20 | (neg) Invalid `userId` (not uuid) → 400 | — | `userId=not-a-uuid&unit=kg` | 400 `VALIDATION_ISSUE`, `"userId" must be a valid GUID` | input validation | PASS |
| T21 | (neg) Decodable base64 but bad cursor payload → 400 | Alice | `cursor=<b64 of {p:'nope',i:'bad'}>` | 400 `VALIDATION_ISSUE`, `"cursor" is invalid or malformed` | edge: invalid cursor (payload) | PASS |

Counts: 27 scenarios — happy/positive: 11 (T1–T9 incl. sub-rows read as positive narrowing, T11,
T11b, T15, T19c) · negative: 13 (T12–T14, T16–T21) · edge: T9/T10/T15 empty-result boundaries.
(Practically: 11 positive, 13 negative, 3 empty-result edges — all green.)

## Observed artefacts (for reproducibility)

- Page-1 `nextCursor` (T2) decodes to `{"p":"2026-03-02T10:30:00.000Z","i":"01a12477-8927-747c-a924-15bb3aa8aa67"}`.
- Conversion factor confirmed: `weight_kg 50 → 110.23 lb` (kg/0.45359237, 2 dp); `99.7903 kg → 220 lb`.
- Tiebreak confirmed: equal `performed_at` ⇒ higher `id` first (`...e2` before `...e1`).

## Coverage check

- Every endpoint in this task: `GET /api/workout-history` — covered (T1–T21).
- Every error response in the design: 400 `VALIDATION_ISSUE` (T12, T13, T16–T21), 404
  `USER_NOT_FOUND` (T14), empty-200 non-error paths (T10, T15, T9) — all covered.
- Acceptance criteria covered: cursor/keyset pagination + stable ordering (T1–T5); partial-name
  filter (T6–T6c); UTC date range (T8); muscle-group filter via join (T7/T7b); required-unit
  conversion + `omit→400` (T11/T11b/T12); unknown user → 404 (T14); known-user-no-data → empty
  (T15).
- Edge cases covered: empty range/no data → empty (T9/T10/T15); invalid cursor/unit/date → 400
  (T13/T16/T18/T21); pagination bounds (T19a–c). Performance at 50k+ (index-backed) is an
  architectural/non-functional property — asserted by design (§3 indexes) and not load-tested in
  this functional black-box pass (note for sign-off).

## Test data left behind (not cleaned)

Prior QA runs could not `DELETE` because the environment's safety classifier blocks delete
statements; this run did not attempt deletes either. Left in `everfit` (safe, idempotent seeds —
inserted `ON CONFLICT DO NOTHING`):
- `muscle_groups`: QA Chest `...b1`, QA Legs `...b2`.
- `exercise_muscle_groups`: `...c1` (Bench→Chest), `...c2` (Squat→Legs).
- `workout_entries`: `...e1`, `...e2` (Bob, 2026-04-01 12:00Z) + 2 `workout_sets` `...f1`, `...f2`.
- Plus the pre-existing Task-5 QA seed (Probe User/Bench/Squat, Alice's 4 entries / 7 sets).

These are additive test fixtures; if a clean DB is required before merge, drop them manually (the
tooling here cannot).

## Approval

This plan is **DRAFT — awaiting human approval**. The draft PR #7 may be marked ready
(`gh pr ready 7`) **only after** a human approves this plan.
