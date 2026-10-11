# Test Plan — 8. PR comparison across named periods

Task: `plans/2026-10-05_2026-10-09/8. PR comparison across named periods/`
Feature ID(s): F8  ·  Endpoint under test: `GET /api/personal-record/comparison`
Status: DRAFT — awaiting human approval

## Summary of contract (from `architecture-design.md` / `architecture.md`)

- Required query params: `userId` (uuid), `exerciseId` (uuid), `granularity` (`week`/`month`/`year`),
  `timezone` (IANA name), `unit` (`kg`/`lb`). Any missing/invalid → **400 `VALIDATION_ISSUE`**.
- 200 → `PersonalRecordComparisonDto`: echoes `userId/exerciseId/granularity/timezone/unit`, plus
  `current` and `previous` blocks (`{ periodStart, periodEnd, maxWeight, maxVolume, best1Rm }`,
  each metric `PersonalRecordMetricDto | null`) and a `delta` block (`{ maxWeight, maxVolume, best1Rm }`,
  each `{ absolute: number|null, percent: number|null, direction }`).
- `direction`: `up`/`down`/`same` (both present), `new` (previous null, current present),
  `none` (current null, previous present). Both null → `same`.
- Period boundaries are **local wall-clock midnight in `timezone`** converted to **UTC instants**;
  returned as `periodStart`/`periodEnd`. Week = Monday ISO start; month = 1st; year = Jan 1.
- `absolute`/`percent` computed on kg then `absolute` converted to the requested unit (2 dp);
  `percent = (absoluteKg / previousKg) × 100` (2 dp), unit-independent. `percent` null if previous null.
- Unknown user → **404 `USER_NOT_FOUND`**; unknown exercise → **404 `EXERCISE_NOT_FOUND`**;
  known user + known exercise with no data in a period → that period's metrics **null** at **200**.

## Preconditions / test data

The running app uses the **real system clock** (no pinned clock), so data must be placed in the
ACTUAL current/previous windows for the zone+granularity under test. Observed at execution:

- Observed "now" (server/DB): **2026-10-10 ~11:49 UTC** (`now()` → `2026-10-10 11:49 UTC`,
  `2026-10-10 18:49` Asia/Ho_Chi_Minh). Current calendar year = **2026**.
- Chosen primary case: **granularity = `year`, timezone = `Asia/Ho_Chi_Minh` (UTC+7, no DST)** — a
  granularity where data can be reliably placed in the real current (2026) and previous (2025) windows.
- Returned `year` windows for Asia/Ho_Chi_Minh (local Jan 1 00:00 → UTC instant):
  - current  `[2025-12-31T17:00:00.000Z, 2026-12-31T17:00:00.000Z)`
  - previous `[2024-12-31T17:00:00.000Z, 2025-12-31T17:00:00.000Z)`

Seed (via `docs/guidelines/tools/database/postgres/DatabaseQuery.ps1` — DB reachable, writes allowed;
all rows deleted after the run):

- User `3cd1b734-f302-4924-83f3-473946f3363d` ("QA-F8 Comparison User").
- Exercises:
  - **E1 bench** `87c2b8d6-e98c-4cdb-bf09-dab02c344365` — data in BOTH years.
  - **E2 squat** `0d70ac51-387f-416a-a69e-4e87273b6e32` — data in CURRENT year only.
  - **E3 deadlift** `d1fd5c89-92d8-4b73-ae02-c03172006671` — data in PREVIOUS year only.
  - **E4 press** `aac41de1-a37f-4479-8355-03889dbead0e` — NO data.
- Sets (all `unit=kg`, `weight_kg = weight`):
  - E1 previous (`performed_at 2025-06-15T10:00:00Z`): (reps 5, 100kg), (reps 10, 80kg).
    → maxWeight 100, maxVolume 800 (10×80), best1Rm 116.6667 (100×35/30).
  - E1 current (`2026-06-15T10:00:00Z`): (reps 5, 110kg), (reps 10, 60kg).
    → maxWeight 110, maxVolume 600, best1Rm 128.3333 (110×35/30).
  - E2 current (`2026-06-15T10:00:00Z`): (reps 6, 90kg).
  - E3 previous (`2025-06-15T10:00:00Z`): (reps 6, 90kg).

## Scenarios

| ID | Title | Precondition / data | Request | Expected result | Maps to |
|----|-------|---------------------|---------|-----------------|---------|
| T1 | Happy path year/kg, both periods | E1 | GET `?userId=U&exerciseId=E1&granularity=year&timezone=Asia/Ho_Chi_Minh&unit=kg` | 200. current period `[2025-12-31T17:00Z,2026-12-31T17:00Z)`; previous `[2024-12-31T17:00Z,2025-12-31T17:00Z)`. current maxWeight 110/reps5, maxVolume vol600/60kg/reps10, best1Rm 1RM128.33/110kg; previous maxWeight 100, maxVolume vol800/80kg, best1Rm 116.67. delta maxWeight {abs 10, pct 10, up}, maxVolume {abs -200, pct -25, down}, best1Rm {abs 11.67, pct 10, up} | AC: current/previous blocks + UTC bounds; delta abs/pct/direction; timezone-aware bounds |
| T2 | Happy path year/lb (unit conversion both periods + delta) | E1 | same as T1 with `unit=lb` | 200. current maxWeight 242.51, maxVolume vol1322.77/132.28, best1Rm 282.93; previous maxWeight 220.46, maxVolume vol1763.7, best1Rm 257.21. delta maxWeight {abs 22.05, pct 10, up}, maxVolume {abs -440.92, pct -25, down}, best1Rm {abs 25.72, pct 10, up}. percent identical to kg (computed on kg) | AC: weights in requested unit, delta on kg converted for display |
| T3 | previous-null → direction `new` | E2 (current only) | `...&exerciseId=E2&granularity=year&timezone=Asia/Ho_Chi_Minh&unit=kg` | 200. current metrics present (90/reps6, vol540, 1RM108); previous all null; delta all three {abs null, pct null, `new`} | AC: previous null → `new`, null percent (no div-by-zero) |
| T4 | current-null-previous-present → `none` | E3 (previous only) | `...&exerciseId=E3&...year...` | 200. current all null; previous metrics present; delta all three {abs null, pct null, `none`} | design D4: regress-to-no-data → `none` |
| T5 | both-null → `same` (known user+exercise, no data) | E4 (no data) | `...&exerciseId=E4&...year...` | 200 (NOT 404). current+previous metrics all null; delta all three {abs null, pct null, `same`} | AC: no-data period = null metrics at 200 |
| T6 | (neg) `unit` omitted → 400 | E1 | omit `unit` | 400 `VALIDATION_ISSUE`, issue `"unit" is required` | AC: unit omission → 400 |
| T7 | (neg) `unit` unsupported → 400 | E1 | `unit=st` | 400 `VALIDATION_ISSUE`, `"unit" must be one of [kg, lb]` | validation |
| T8 | (neg) `timezone` omitted → 400 | E1 | omit `timezone` | 400 `VALIDATION_ISSUE`, `"timezone" is required` | required IANA timezone |
| T9 | (neg) `timezone` invalid → 400 | E1 | `timezone=Mars/Phobos` | 400 `VALIDATION_ISSUE`, `"timezone" contains an invalid value` | IANA validity check |
| T10 | (neg) `granularity` omitted → 400 | E1 | omit `granularity` | 400 `VALIDATION_ISSUE`, `"granularity" is required` | validation |
| T11 | (neg) `granularity` invalid → 400 | E1 | `granularity=decade` | 400 `VALIDATION_ISSUE`, `"granularity" must be one of [week, month, year]` | validation |
| T12 | (neg) unknown user → 404 | — | `userId=<unknown uuid>` | 404 `USER_NOT_FOUND` | AC: unknown user → 404 USER_NOT_FOUND |
| T13 | (neg) unknown exercise → 404 | valid user | `exerciseId=<unknown uuid>` | 404 `EXERCISE_NOT_FOUND` | design 2026-10-10: unknown exercise → 404 |
| T14 | (neg) malformed `userId` → 400 | — | `userId=not-a-uuid` | 400 `VALIDATION_ISSUE`, `"userId" must be a valid GUID` | validation |
| T15 | UTC boundary distinct from non-UTC | E1 | `...&timezone=UTC&granularity=year...` | 200. current `[2026-01-01T00:00Z,2027-01-01T00:00Z)`; previous `[2025-01-01T00:00Z,2026-01-01T00:00Z)` — differs from T1 HCM bounds by the +7 offset | edge: timezone-aware boundaries |
| T16 | month granularity boundaries (HCM) | E1 | `...&granularity=month&timezone=Asia/Ho_Chi_Minh...` | 200. current `[2026-09-30T17:00Z,2026-10-31T17:00Z)` (local Oct 1→Nov 1); previous `[2026-08-31T17:00Z,2026-09-30T17:00Z)`; metrics null (seed is June) | edge: month boundaries, year-local 1st |
| T17 | week granularity boundaries (HCM, Monday ISO) | E1 | `...&granularity=week&timezone=Asia/Ho_Chi_Minh...` | 200. current `[2026-10-04T17:00Z,2026-10-11T17:00Z)` (local Mon Oct 5→Mon Oct 12); previous `[2026-09-27T17:00Z,2026-10-04T17:00Z)` | edge: Monday ISO week start, timezone-aware |

## Execution results (run 2026-10-10, observed now ≈ 11:49 UTC)

All scenarios executed against the running app on `http://localhost:3000` with the seed above.

| ID | Result | Actual (key assertions) |
|----|--------|-------------------------|
| T1 | PASS | Windows and all metrics/deltas exactly as expected: maxWeight {10, 10, up}, maxVolume {-200, -25, down}, best1Rm {11.67, 10, up}; current/previous bounds `2025-12-31T17:00Z…2026-12-31T17:00Z` / `2024-12-31T17:00Z…2025-12-31T17:00Z` |
| T2 | PASS | maxWeight cur 242.51 / prev 220.46, delta {22.05, 10, up}; maxVolume vol cur 1322.77 / prev 1763.7, delta {-440.92, -25, down}; best1Rm cur 282.93 / prev 257.21, delta {25.72, 10, up}; percent identical to kg |
| T3 | PASS | current 90/vol540/1RM108; previous all null; delta all `new`, abs/pct null |
| T4 | PASS | current all null; previous 90/vol540/1RM108; delta all `none`, abs/pct null |
| T5 | PASS | 200; current+previous all null; delta all `same`, abs/pct null |
| T6 | PASS | 400 `VALIDATION_ISSUE` `"unit" is required` |
| T7 | PASS | 400 `VALIDATION_ISSUE` `"unit" must be one of [kg, lb]` |
| T8 | PASS | 400 `VALIDATION_ISSUE` `"timezone" is required` |
| T9 | PASS | 400 `VALIDATION_ISSUE` `"timezone" contains an invalid value` |
| T10 | PASS | 400 `VALIDATION_ISSUE` `"granularity" is required` |
| T11 | PASS | 400 `VALIDATION_ISSUE` `"granularity" must be one of [week, month, year]` |
| T12 | PASS | 404 `USER_NOT_FOUND` |
| T13 | PASS | 404 `EXERCISE_NOT_FOUND` |
| T14 | PASS | 400 `VALIDATION_ISSUE` `"userId" must be a valid GUID` |
| T15 | PASS | UTC current `2026-01-01T00:00Z…2027-01-01T00:00Z`, previous `2025-01-01…2026-01-01` — distinct from T1 by +7h, confirms offset applied at the instant |
| T16 | PASS | current `2026-09-30T17:00Z…2026-10-31T17:00Z`, previous `2026-08-31T17:00Z…2026-09-30T17:00Z`; metrics null |
| T17 | PASS | current `2026-10-04T17:00Z…2026-10-11T17:00Z` (Mon Oct 5 local), previous `2026-09-27T17:00Z…2026-10-04T17:00Z` |

Overall: **17/17 PASS** (5 happy/positive incl. delta directions, 9 negative, 3 boundary/edge).
Seed data deleted after the run (DELETE allowed; verified the user now returns 404).

## Coverage check

- Endpoint in this task: `GET /api/personal-record/comparison` — covered (T1–T17).
- Every error response in the design:
  - 400 `VALIDATION_ISSUE` (unit, timezone, granularity, malformed uuid) — T6–T11, T14.
  - 404 `USER_NOT_FOUND` — T12. 404 `EXERCISE_NOT_FOUND` — T13.
  - no-data period → null metrics at 200 (not error) — T4, T5, T16.
- Acceptance criteria covered: current/previous blocks with UTC bounds + three PRs (T1);
  delta abs/percent/direction up+down (T1/T2); no-data period null metrics (T4/T5);
  previous-null → `new`/null percent (T3); required unit omission → 400 (T6) + conversion (T2);
  unknown user → 404 (T12).
- Edge cases covered: timezone-aware boundaries + non-UTC vs UTC (T1 vs T15); Monday ISO week start
  (T17); month/year-local 1st and rollover to prior period (T16, T1 previous=2025);
  current-null-previous-present → `none` D4 (T4); unknown exercise → 404 (T13).
- Gaps / not covered: no DST-transition zone exercised at runtime (America/New_York DST correctness is
  covered by the unit `period-boundary.spec.ts`; the real-clock app only lets us place data reliably in
  year/current windows). No `week`/`month` happy path WITH data (data cannot be reliably seeded into the
  moving current week/month without recomputing at each run); boundaries for both are verified instead
  (T16/T17). These are acceptable given the real-clock constraint and the unit-test coverage.
