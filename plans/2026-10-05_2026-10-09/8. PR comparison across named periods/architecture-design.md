# Architecture Design — Task 8: PR comparison across named periods

- **Task:** `8. PR comparison across named periods` — Feature **F8**.
- **Depends on:** Task 7 (Personal records); uses the injected time context from Task 1.
- **Goal:** Compare a user+exercise's three PRs between the current and the immediately preceding
  period (week / month / year), returning `current`/`previous` blocks plus a server-computed `delta`.

See `architecture.md` §3 (`..._performed_at` PR index), §7 (period math), §9, and the S1 resolution
in `goal.md`.

## Database changes

- **None** — reuses Task 5 schema; period-bounded aggregation uses
  `ix_workout_sets_user_id_exercise_id_performed_at` to narrow to the period window before the top-1.

## API changes

- **`GET /api/personal-record/comparison`** (`@ApiTags('Personal records')`,
  `@ApiOperation({ summary: 'Compare personal records across periods' })`). New. 200.
  - Query DTO `GetPersonalRecordComparisonQueryDto`
    (`get-personal-record-comparison-query.dto.ts`): `userId` (uuid, required), `exerciseId` (uuid,
    required), `granularity` (required — `Joi.string().valid('week','month','year')`), `unit`
    (**required** — `weightUnitJoiSchema`; omission → 400), **`timezone` (required — an IANA
    timezone name, e.g. `Asia/Ho_Chi_Minh`, `America/New_York`)**.
    - `timezone` validation: a reusable `src/common/schemas/timezone.joi-schema.ts` →
      `timezoneJoiSchema` = `Joi.string().trim()` plus a **custom validity check** that the string is
      a real IANA zone (e.g. `Intl.DateTimeFormat(undefined, { timeZone: value })` succeeds / a
      zone-library lookup). Missing or invalid zone → **400 `VALIDATION_ISSUE`**.
  - 200 → `PersonalRecordComparisonDto`:
    - `granularity`, `unit`.
    - `current` / `previous`: each `{ periodStart, periodEnd, maxWeight, maxVolume, best1Rm }` where
      each metric is `PersonalRecordMetricDto | null` (same shape as Task 7; weights in requested
      unit). A period with no data → its three metrics are **null**.
    - `delta`: `{ maxWeight, maxVolume, best1Rm }`, each a `PersonalRecordDeltaDto`:
      `{ absolute: number | null, percent: number | null,
      direction: 'up'|'down'|'same'|'new'|'none' }`.
      - `absolute` = current − previous (in requested unit; computed on kg then converted).
      - If `previous` is null and `current` present → `direction: 'new'`, `percent: null`,
        `absolute: null`.
      - If `current` is null but `previous` is present → `direction: 'none'`, `absolute: null`,
        `percent: null` (human decision **D4** — a metric that regressed to no-data is reported as
        `none`, not a numeric drop).
      - If both null → `direction: 'same'`, `absolute: null`, `percent: null`.
      - Else (both present) → `direction` by sign of `absolute` (`'same'` when equal); `percent` =
        `(absolute / previous) × 100` (previous ≠ 0).
  - Flow: validate request (Joi, incl. IANA `timezone`) → **validate user exists** then **validate
    exercise exists** → compute timezone-aware period windows → aggregate per period.
  - Errors:
    - 400 `VALIDATION_ISSUE` — missing/invalid `unit`, `granularity`, or `timezone` (not a valid IANA
      zone).
    - 404 `USER_NOT_FOUND` (`UserByIdNotFoundException`) — unknown user.
    - 404 `EXERCISE_NOT_FOUND` (`ExerciseByIdNotFoundException`, reused from Task 3) — unknown
      `exerciseId`. Applied here for consistency with the 2026-10-10 PR decision (Task 7), since this
      sibling endpoint lives in the same module and also takes `exerciseId`.
    - A **known** user + **known** exercise with no data in a period → that period's metrics are
      **null** at **200** (empty-not-error) — unchanged.

  > **Note (2026-10-10):** the human decision was stated for the PR endpoint (Task 7). This design
  > mirrors it on the sibling comparison endpoint to avoid an inconsistent contract within the same
  > controller. Flag to the product-owner for confirmation; if they want comparison to keep the old
  > "unknown exercise → all-null 200" behavior, only this endpoint's exercise-existence check is
  > removed.

## Period boundaries (timezone-aware, from injected time context)

"now" still comes from `ITimeContext.getUtcNowAsync()` (no static `now`) — the required `timezone`
param only affects **how the period boundaries are derived from that instant**. Boundaries are
computed as **local wall-clock instants in `timezone`**, then converted to **UTC instants** for the
`workout_sets.performed_at` query (storage stays UTC). Each window is half-open `[start, end)`:

- **week:** take `now` interpreted in `timezone`; the current week is the one containing that local
  date, starting **Monday 00:00:00 local** (ISO-8601, per `architecture.md` §7) up to next Monday
  00:00:00 local; previous week = the preceding Monday→Monday.
- **month:** current month start = the **1st at 00:00:00 local**; end = 1st of next month 00:00:00
  local; previous month = the prior calendar month (**handle December→January year rollover**).
- **year:** current year start = **Jan 1 00:00:00 local**; end = next Jan 1 00:00:00 local; previous
  year = the prior calendar year.

**DST / offset correctness (explicit):** constructing a local midnight and converting it to a UTC
instant **must respect the zone's UTC offset at that specific instant** (offsets change across DST
transitions, and a local midnight can even be skipped or repeated on a transition day). This rules
out hand-rolled fixed-offset math — a proper timezone/IANA library is required (the developer
chooses/proposes the dependency, e.g. Luxon or `@date-fns/tz`/`date-fns-tz`; note it in the Task 1
dependency set or this task's deps).

Each block's `periodStart`/`periodEnd` are returned as the **UTC instants** of those local
boundaries (the values used for the query), so the response is unambiguous regardless of the
caller's zone.

## Environment variables

None.

## Contract

- Reuse core `IWorkoutService.getPersonalRecordsAsync(criteria)` (Task 7) with `from`/`to` set to each
  period window — no new core method required. (Optionally add a thin
  `getPersonalRecordsForPeriodAsync` wrapper; the orchestration service can call `getPersonalRecordsAsync`
  twice.)
- API orchestration in the existing `personal-record` module:
  - `services/personal-record-comparison/` → `IPersonalRecordComparisonService.compareAsync`
    orchestrating: validate user exists (`IUserService` → `UserByIdNotFoundException`); **validate
    exercise exists** (`IExerciseService.existsByIdAsync` → `ExerciseByIdNotFoundException`); compute
    **timezone-aware** period windows from `ITimeContext.getUtcNowAsync()` + the requested `timezone`;
    call the aggregation for current + previous; convert kg → unit; compute deltas
    (direction/percent/new/none/same branches). Token `SERVICE__PERSONAL_RECORD_COMPARISON`. (The
    `personal-record` module already imports `ExerciseModule` per Task 7.)
  - Add the `comparison` route + DTOs/schemas to `PersonalRecordApiController`
    (`getComparisonAsync`).
- Period-boundary helper: a **pure** function/service taking `(now: Date, granularity, timezone)` and
  returning the current + previous `PeriodWindow`s as **UTC instants**, using the chosen timezone
  library — deterministic and unit-testable with a fixed `now` (time + zone passed in, no internal
  clock). E.g. `src/common/time/period-boundary.ts` or under the module.
- Models: `src/models/periods/period-window.ts` (`{ start: Date; end: Date }` — UTC instants).
- Reusable schema: `src/common/schemas/timezone.joi-schema.ts` → `timezoneJoiSchema` (IANA validity
  check), consumed by `GetPersonalRecordComparisonQueryDto`.

## Tests to define (in-memory DB + fake clock)

- `src/modules/apis/personal-record/services/personal-record-comparison/personal-record-comparison.service.spec.ts`:
  `describe('compareAsync')` — for each granularity, correct **timezone-aware** window boundaries
  (fake clock at a fixed instant + a given `timezone`); both periods with data → delta
  `up`/`down`/`same` branches; previous null → `direction:'new'`, null percent (no divide-by-zero);
  **current null but previous present → `direction:'none'`, null absolute/percent (D4)**; both null →
  `same`/nulls; unknown user → `UserByIdNotFoundException`; **unknown exercise →
  `ExerciseByIdNotFoundException`** (asserted before aggregation); known user + known exercise with an
  empty period → that period null (not an error); weights/deltas converted to requested unit.
- A **period-boundary helper spec** (pure, fixed `now` passed in) — week/month/year start/end as UTC
  instants, covering:
  - a **non-UTC zone** (e.g. `Asia/Ho_Chi_Minh`, UTC+7, no DST) — verify local Monday/1st/Jan-1
    00:00 maps to the correct UTC instant (e.g. 17:00 the previous UTC day), distinct from the UTC
    result.
  - **Monday ISO week start** in the requested zone (not Sunday).
  - **month and year rollover** (e.g. local Jan → previous = December of prior year).
  - a **DST-boundary case** (e.g. `America/New_York` around a spring-forward / fall-back date) —
    verify the local→UTC offset used is the one in effect **at that instant**, not a fixed offset.
- `src/common/schemas/timezone.joi-schema.spec.ts` — accepts a valid IANA zone; rejects a bogus zone
  (`"Mars/Phobos"`) and empty/missing → validation failure.
- `src/modules/apis/personal-record/personal-record-api.controller.spec.ts` — add
  `describe('getComparisonAsync')`: missing/invalid `unit`, `granularity`, or `timezone` →
  `ValidationException`; returns `PersonalRecordComparisonDto`.

## Existing tests that must change

- **None.** The Task 7 controller spec is **extended** with a new `describe` (additive, same file,
  per unit-testing §5 "same function grouped"); the existing `getAsync` cases are untouched. No
  existing test is modified or deleted → **ready**. (If the developer instead chooses to split the
  controller spec, that would touch an existing test and require confirmation — recommended approach
  is additive, keeping it ready.)

## Files to create/change

Add the comparison service folder + DTOs/schemas to `apis/personal-record/`; `period-window.ts`;
the **timezone-aware** period-boundary helper; `src/common/schemas/timezone.joi-schema.ts`. Add a
**timezone/IANA library dependency** (developer's choice, e.g. Luxon / `date-fns-tz`) via **pnpm**.
Change: extend `PersonalRecordApiController` + its module. No `app.module.ts` change (module already
registered in Task 7).

## Done when

`pnpm nx test api` passes (all delta — incl. `none` — + timezone-aware boundary — incl. a non-UTC
zone and a DST boundary — + unknown-exercise branches with a fake clock); `pnpm nx build api`
succeeds; period boundaries are computed as local wall-clock in the required `timezone` (Monday ISO
week start) then converted to **UTC instants** respecting the zone's offset at that instant;
null-previous → `new`/null percent; current-null-previous-present → `none`; missing/invalid
`unit`/`granularity`/`timezone` → 400; unknown user → 404 `USER_NOT_FOUND`; unknown exercise →
404 `EXERCISE_NOT_FOUND`; conventions met.
