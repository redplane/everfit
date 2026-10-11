# Test Plan — 7. Personal records

Task: `plans/2026-10-05_2026-10-09/7. Personal records/`
Feature ID(s): F7  ·  Endpoints under test: `GET /api/personal-record`
Status: DRAFT — awaiting human approval
Gate decision: **Externally testable** (adds `GET /api/personal-record`). Not a no-op.

Executed: 2026-10-10 against a live app instance on `http://localhost:3000` over the live
`everfit-postgres` DB (schema already migrated — 7 tables present). Every scenario below was run and
its **Actual** recorded. All PASS.

## Contract reference (from `architecture-design.md` + source)

- 200 → `PersonalRecordDto` `{ userId, exerciseId, unit, maxWeight, maxVolume, best1Rm }`.
  - `maxWeight`: `{ weight, reps, achievedAt }`
  - `maxVolume`: `{ weight, reps, achievedAt, volume }`
  - `best1Rm`: `{ weight, reps, achievedAt, oneRepMax }`
  - weights/volume/oneRepMax in the requested `unit` (converted from kg, 2 dp); each metric `null`
    when the known user+exercise has no sets.
- Aggregation on normalized `weight_kg`; tie-break `ORDER BY <metric> DESC, performed_at ASC, id ASC`
  → earliest performed_at wins. Epley = `weight_kg × (1 + reps/30)`.
- Errors: 400 `VALIDATION_ISSUE` (`{ code, issues }`); 404 `USER_NOT_FOUND` / `EXERCISE_NOT_FOUND`
  (`{ code, message }`). lb factor-to-base = `0.45359237` (kg→lb = value / 0.45359237, round 2 dp).

## Preconditions / test data

Seeded via the PostgreSQL helper (`docs/guidelines/tools/database/postgres/DatabaseQuery.ps1`,
`-Action Query`) — DB tool was reachable. Isolated UUIDs so pre-existing rows are untouched.

- User `aaaa0000-0000-4000-8000-000000000007` ("QA PR User").
- Exercise `bbbb0000-0000-4000-8000-000000000007` ("QA PR Exercise (Task7)") — has the 5 sets below.
- Exercise `bbbb0000-0000-4000-8000-000000000008` ("QA Empty Exercise (Task7)") — **no sets**
  (for the empty-not-error case).
- 5 sets on (QA PR User, QA PR Exercise), one parent `workout_entry` each:

  | Set | performed_at (UTC)     | reps | weight | unit | weight_kg  | role                                       |
  | --- | ---------------------- | ---- | ------ | ---- | ---------- | ------------------------------------------ |
  | A1  | 2026-01-05T10:00:00Z   | 1    | 200    | kg   | 200.0000   | max-weight **tie winner** (earliest of 200)|
  | A2  | 2026-01-06T10:00:00Z   | 1    | 200    | kg   | 200.0000   | max-weight tie loser (later)               |
  | B   | 2026-01-02T10:00:00Z   | 20   | 100    | kg   | 100.0000   | max-volume winner (20×100 = 2000)          |
  | C   | 2026-01-03T10:00:00Z   | 10   | 180    | kg   | 180.0000   | best-Epley winner (180×(1+10/30) = 240)    |
  | D   | 2026-01-07T10:00:00Z   | 1    | 440    | lb   | 199.5806   | mixed-unit probe (raw 440 > 200 but 199.58 kg < 200) |

Pre-run DB check confirmed the three top-1 index queries (same SQL as the service) return A1 /
B / C respectively — expected winners are derived from the data, not assumed.

- Unknown user id (not in DB): `99999999-9999-4999-8999-999999999999`.
- Unknown exercise id (not in DB): `88888888-8888-4888-8888-888888888888`.

## Scenarios

All requests: `GET /api/personal-record` with query params. Negative tests flagged `(neg)`.

| ID  | Title | Precondition / data | Request (query) | Expected result | Maps to |
|-----|-------|---------------------|-----------------|-----------------|---------|
| T1  | Heaviest single set (kg) | seeded sets | `userId=U&exerciseId=E&unit=kg` | 200; `maxWeight={weight:200,reps:1,achievedAt:"2026-01-05T10:00:00.000Z"}` | AC: heaviest set + date/reps |
| T2  | Highest volume (kg) | seeded sets | same as T1 | 200; `maxVolume={weight:100,reps:20,volume:2000,achievedAt:"2026-01-02T10:00:00.000Z"}` | AC: highest volume + date |
| T3  | Best Epley 1RM (kg) | seeded sets | same as T1 | 200; `best1Rm={weight:180,reps:10,oneRepMax:240,achievedAt:"2026-01-03T10:00:00.000Z"}` — 180×(1+10/30)=240 | AC: best Epley 1RM + date |
| T4  | Deterministic tie-break | A1 & A2 both 200 kg | same as T1 | maxWeight winner is A1 (2026-01-05), **not** A2 (2026-01-06) — earliest performed_at | design: tie-break earliest |
| T5  | Mixed-unit normalization | D is 440 lb (199.58 kg) | same as T1 | maxWeight stays 200 kg (A1); D's raw 440 does **not** win — winners computed on kg | edge: aggregate on normalized kg |
| T6  | Output converted to lb | seeded sets | `userId=U&exerciseId=E&unit=lb` | 200; maxWeight.weight=440.92; maxVolume.weight=220.46, volume=4409.25; best1Rm.weight=396.83, oneRepMax=529.11 (kg÷0.45359237, 2 dp) | AC: PR weights in requested unit |
| T7  | (neg) missing unit → 400 | — | `userId=U&exerciseId=E` | 400; `{code:"VALIDATION_ISSUE", issues:[{message:"\"unit\" is required"}]}` | AC: no default unit → 400 |
| T8  | (neg) unsupported unit → 400 | — | `userId=U&exerciseId=E&unit=stone` | 400; `VALIDATION_ISSUE`, `"unit" must be one of [kg, lb]` | design: Joi rejects unknown unit |
| T9  | (neg) unknown user → 404 | user not in DB | `userId=BADU&exerciseId=E&unit=kg` | 404; `{code:"USER_NOT_FOUND", message:…}` | AC: unknown userId → 404 USER_NOT_FOUND |
| T10 | (neg) unknown exercise → 404 | exercise not in DB | `userId=U&exerciseId=BADE&unit=kg` | 404; `{code:"EXERCISE_NOT_FOUND", message:…}` | design 2026-10-10: unknown exerciseId → 404 |
| T11 | Known user + known exercise, no sets → 200 null | empty exercise | `userId=U&exerciseId=EMPTY&unit=kg` | 200; `maxWeight=null, maxVolume=null, best1Rm=null` (not an error) | AC/edge: no data → null, not error |
| T12 | (neg) invalid uuid → 400 | — | `userId=not-a-uuid&exerciseId=E&unit=kg` | 400; `VALIDATION_ISSUE`, `"userId" must be a valid GUID` | design: ids validated |

U = `aaaa0000-0000-4000-8000-000000000007`, E = `bbbb0000-0000-4000-8000-000000000007`,
EMPTY = `bbbb0000-0000-4000-8000-000000000008`,
BADU = `99999999-9999-4999-8999-999999999999`, BADE = `88888888-8888-4888-8888-888888888888`.

## Execution results (actual vs expected) — 2026-10-10

| ID  | Status | Actual |
|-----|--------|--------|
| T1  | PASS | `maxWeight={"weight":200,"reps":1,"achievedAt":"2026-01-05T10:00:00.000Z"}` |
| T2  | PASS | `maxVolume={"weight":100,"reps":20,"achievedAt":"2026-01-02T10:00:00.000Z","volume":2000}` |
| T3  | PASS | `best1Rm={"weight":180,"reps":10,"achievedAt":"2026-01-03T10:00:00.000Z","oneRepMax":240}` (Epley exact 240) |
| T4  | PASS | maxWeight.achievedAt = 2026-01-05 (A1), not 2026-01-06 (A2) — earliest wins |
| T5  | PASS | maxWeight = 200 kg (A1); 440 lb set (199.58 kg) did not win — normalized comparison confirmed |
| T6  | PASS | `maxWeight.weight=440.92`, `maxVolume.weight=220.46/volume=4409.25`, `best1Rm.weight=396.83/oneRepMax=529.11` |
| T7  | PASS | 400 `{"code":"VALIDATION_ISSUE","issues":[{"message":"\"unit\" is required"}]}` |
| T8  | PASS | 400 `{"code":"VALIDATION_ISSUE","issues":[{"message":"\"unit\" must be one of [kg, lb]"}]}` |
| T9  | PASS | 404 `{"code":"USER_NOT_FOUND","message":"User with id \"99999999-…\" was not found."}` |
| T10 | PASS | 404 `{"code":"EXERCISE_NOT_FOUND","message":"Exercise with id \"88888888-…\" was not found."}` |
| T11 | PASS | 200 `{…,"maxWeight":null,"maxVolume":null,"best1Rm":null}` |
| T12 | PASS | 400 `{"code":"VALIDATION_ISSUE","issues":[{"message":"\"userId\" must be a valid GUID"}]}` |

All 12 PASS (6 happy/positive incl. conversion, 4 negative, plus tie-break and mixed-unit edges).

## Coverage check

- **Every endpoint in this task:** `GET /api/personal-record` — covered (T1–T12). No gap.
- **Every error response in the design:** 400 `VALIDATION_ISSUE` (T7, T8, T12), 404
  `USER_NOT_FOUND` (T9), 404 `EXERCISE_NOT_FOUND` (T10). No gap.
- **Acceptance criteria covered:** heaviest set (T1), highest volume (T2), best Epley 1RM (T3),
  required-unit output conversion (T6), omitted unit → 400 (T7), unknown user → 404 (T9), no-sets →
  null-not-error (T11).
- **Edge cases covered:** no data → null (T11), aggregation on normalized kg / mixed units (T5),
  deterministic tie-break earliest performed_at (T4), unknown exercise → 404 (T10, 2026-10-10
  decision), unsupported unit rejected (T8).
- **Note:** the PR response returns only converted values (no original `weight`/`unit` field);
  originals are retained in `workout_sets` storage (verified present in the seed rows via the DB
  helper), consistent with the contract.

## Test-data cleanup

Seed rows used isolated `aaaa…/bbbb…/cccc…/dddd…` UUIDs and did not affect other data. **Cleanup was
performed and verified** (2026-10-10): deleted in FK order via the DB helper —
`workout_sets` (5) → `workout_entries` (5) → `exercises` (2 bbbb… ids) → `users` (1 aaaa… id);
post-check `count(*) = 0` for the seed user's sets. The DB is back to its pre-test state. (DELETE was
not blocked in this run; re-seed with `scratchpad/seed.sql` if re-running is needed.)
