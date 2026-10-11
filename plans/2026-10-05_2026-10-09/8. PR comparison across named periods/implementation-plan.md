# Implementation Plan — Task 8: PR comparison across named periods (F8)

- **Task:** `8. PR comparison across named periods` — Feature **F8**.
- **Depends on:** Task 7 (Personal records); uses the injected time context (Task 1), the unit
  conversion registry (Task 4), the user/exercise existence checks (Task 2/3), and the Task 7 PR
  aggregation (`IWorkoutService.getPersonalRecordsAsync`, which already accepts optional `from`/`to`).
- **Phase:** PLAN ONLY — no production code written yet. Awaiting approval.

This plan is consistent with the confirmed `architecture-design.md` and `architecture.md` (§3, §6,
§7, §9). It adds **one API endpoint** and **no schema change**.

---

## 1. Branch / PR plan (linear stacking)

- **Branch:** `feat/8-pr-comparison`, branched off **`feat/7-personal-records`** (NOT `main`).
- **PR base:** `feat/7-personal-records` (stacked), so the diff shows only Task 8's changes.
- **Draft PR** opened after tests are green; left as a draft pending `reviewer` + `qa` sign-off. I do
  not mark it ready.

---

## 2. Scope summary

New endpoint **`GET /api/personal-record/comparison`** on the existing `PersonalRecordApiController`
(`@ApiTags('Personal records')`). It compares the three PRs (max weight, max volume, best Epley 1RM)
for one `(user, exercise)` between the **current** period and the **immediately preceding** period of
a chosen granularity (`week` / `month` / `year`), returning `current` + `previous` blocks plus a
server-computed `delta` per metric. Period boundaries are computed as **local wall-clock instants in a
caller-supplied IANA `timezone`**, then converted to UTC instants to query `performed_at`. "now" still
comes from the injected time context (no static `new Date()` / `Date.now()`); the `timezone` only
affects boundary derivation. Reuses `getPersonalRecordsAsync({ userId, exerciseId, from, to })` twice
(once per window).

> **Contract change (human decision, 2026-10-10):** D1 changed from pure-UTC boundaries to
> **timezone-aware** boundaries via a required `timezone` param; D4's current-null-but-previous-present
> marker is **`'none'`** (not `'down'`). The architect is updating `architecture-design.md` to this
> contract in parallel; this plan aligns to it.

---

## 3. Files to create / change (exact paths)

All paths under `apps/api/src/`.

### 3.1 Models (pure data shapes)

- **CREATE** `models/periods/period-window.ts` — `PeriodWindow { start: Date; end: Date }`
  (half-open `[start, end)` UTC).
- **CREATE** `models/periods/period-comparison-windows.ts` —
  `PeriodComparisonWindows { current: PeriodWindow; previous: PeriodWindow }`.
- **CREATE** `models/periods/period-granularity.ts` — `enum PeriodGranularity { WEEK = 'week', MONTH
  = 'month', YEAR = 'year' }` (values are the wire tokens — the same deliberate value-is-wire pattern
  already approved for unit codes; keeps the Joi `valid(...)` list, the switch, and the wire in one
  place and prevents drift). The Joi schema validates against `Object.values(PeriodGranularity)`.

### 3.2 Timezone-aware period-boundary helper (pure function — no DI, no clock)

- **CREATE** `common/periods/period-boundary.ts` — pure function
  `computePeriodComparisonWindows(now: Date, granularity: PeriodGranularity, timezone: string):
  PeriodComparisonWindows`.
  - The clock value (`now`, a UTC `Date`) is **passed in** (the orchestration service gets it from
    `ITimeContext`), keeping the function trivially testable with fixed instants. The `timezone` is a
    validated IANA zone name.
  - Logic (via the chosen tz library — see §4.4): take `now`, express it in `timezone`, find the
    local wall-clock period start (Monday 00:00:00 local / 1st 00:00:00 local / Jan 1 00:00:00
    local), add one period to get the local end, subtract one period for the previous window — then
    convert each **local wall-clock instant back to a UTC `Date`** honoring that zone's offset **at
    that instant** (so DST transitions are correct). The returned `PeriodWindow.start/end` are UTC
    `Date`s used directly as `performed_at` bounds.
  - A `default:` branch throws an `Error` for an unreachable granularity (defensive; Joi already
    constrains the input) — covered by a direct test calling it with a bad value cast.
  - **No hand-rolled offset math** — all local↔UTC and local-field arithmetic goes through the tz
    library's zone-aware API.

### 3.3 Request DTO + Joi schema

- **CREATE** `modules/apis/personal-record/dto/get-personal-record-comparison-query.dto.ts` —
  `GetPersonalRecordComparisonQueryDto { userId: string; exerciseId: string; granularity:
  PeriodGranularity; unit: string; timezone: string }` with `@ApiProperty` docs (mirrors the Task 7
  query DTO; `timezone` documented with an example `'Asia/Ho_Chi_Minh'`).
- **CREATE** `common/schemas/timezone.joi-schema.ts` — reusable `timezoneJoiSchema`:
  `Joi.string().custom(...)` that accepts a non-empty string and rejects it unless it is a real IANA
  zone. The custom validator probes `Intl.DateTimeFormat(undefined, { timeZone: value })` inside a
  `try/catch` (a `RangeError` → unknown zone → `helpers.error('any.invalid')`), so the accepted set is
  the runtime's full IANA database rather than a hardcoded list. (This `try/catch` is a boundary
  adapter around a throwing platform API, not control-flow in a controller — allowed.) Placed in
  `common/schemas` next to `weight-unit.joi-schema.ts` for reuse.
- **CREATE** `modules/apis/personal-record/dto/get-personal-record-comparison-query.joi-schema.ts` —
  `getPersonalRecordComparisonQueryJoiSchema`:
  - `userId`: `userIdJoiSchema.required()`.
  - `exerciseId`: `Joi.string().uuid().required()`.
  - `granularity`: `Joi.string().valid(...Object.values(PeriodGranularity)).required()` — omission /
    unknown → 400.
  - `unit`: `weightUnitJoiSchema.required()` — omission / unsupported → 400 (reuses the shared schema).
  - `timezone`: `timezoneJoiSchema.required()` — omission / invalid IANA zone → 400 `VALIDATION_ISSUE`.

### 3.4 Response DTOs

- **REUSE** existing `dto/personal-record-metric.dto.ts` (`PersonalRecordMetricDto`) unchanged for the
  per-metric PR shape inside each period block.
- **CREATE** `dto/personal-record-period.dto.ts` — `PersonalRecordPeriodDto { periodStart: Date;
  periodEnd: Date; maxWeight: PersonalRecordMetricDto | null; maxVolume: PersonalRecordMetricDto |
  null; best1Rm: PersonalRecordMetricDto | null }`.
- **CREATE** `dto/personal-record-delta.dto.ts` — `PersonalRecordDeltaDto { absolute: number | null;
  percent: number | null; direction: PersonalRecordDeltaDirection }`. Direction typed via
  `enum PersonalRecordDeltaDirection { UP='up', DOWN='down', SAME='same', NEW='new', NONE='none' }`
  (enum with wire values, same pattern as granularity). `'none'` is the no-data marker for a metric
  present previously but absent now (D4).
- **CREATE** `dto/personal-record-comparison.dto.ts` — `PersonalRecordComparisonDto { userId; exerciseId;
  granularity; unit; timezone; current: PersonalRecordPeriodDto; previous: PersonalRecordPeriodDto;
  delta: { maxWeight: PersonalRecordDeltaDto; maxVolume: PersonalRecordDeltaDto; best1Rm:
  PersonalRecordDeltaDto } }`. (A small `PersonalRecordComparisonDeltaDto` wrapper class holds the
  three delta blocks, for clean Swagger typing.) `timezone` echoes the requested zone.

### 3.5 Orchestration service (interface-first, new folder)

- **CREATE** `modules/apis/personal-record/services/personal-record-comparison/`:
  - `personal-record-comparison-injection-tokens.ts` — `enum
    PersonalRecordComparisonServiceInjectionTokens { SERVICE__PERSONAL_RECORD_COMPARISON =
    'SERVICE__PERSONAL_RECORD_COMPARISON' }`.
  - `personal-record-comparison-service.interface.ts` — `IPersonalRecordComparisonService {
    compareAsync(query: GetPersonalRecordComparisonQueryDto): Promise<PersonalRecordComparisonDto> }`.
  - `personal-record-comparison.service.ts` — `PersonalRecordComparisonService` (see §4 for logic).
    Injects `SERVICE__USER`, `SERVICE__EXERCISE`, `SERVICE__SCALE_UNIT_CONVERSION`, `SERVICE__WORKOUT`,
    and `CONTEXT__TIME` (the time context) — all via tokens/interfaces.
  - `personal-record-comparison.service.module.ts` — provides the service via its token and exports it;
    imports `UserModule`, `ExerciseModule`, `ScaleUnitModule`, `WorkoutModule`, `TimeContextModule`.

### 3.6 Controller + module (extend existing)

- **EDIT** `modules/apis/personal-record/personal-record-api.controller.ts` — add
  `getComparisonAsync(@Query() query)` at route `@Get('comparison')` (resolves to
  `/api/personal-record/comparison`). Thin: validate with `getPersonalRecordComparisonQueryJoiSchema`
  via `JoiService`, then delegate to `IPersonalRecordComparisonService.compareAsync`. Inject the new
  service via its token in the constructor (additive; `getAsync` untouched).
- **EDIT** `modules/apis/personal-record/personal-record-api.module.ts` — add
  `PersonalRecordComparisonServiceModule` to `imports`.
- **No `app.module.ts` change** — `PersonalRecordApiModule` is already registered (Task 7).

---

## 4. Logic detail

### 4.1 Flow (orchestration `compareAsync`) — honoring request-flow order

1. (Validation happened in the controller via Joi.)
2. **Domain check — user exists:** `IUserService.existsByIdAsync(userId)`; else throw
   `UserByIdNotFoundException` (404 `USER_NOT_FOUND`). No aggregation runs.
3. **Domain check — exercise exists:** `IExerciseService.existsByIdAsync(exerciseId)`; else throw
   `ExerciseByIdNotFoundException` (404 `EXERCISE_NOT_FOUND`) — the human-confirmed mirror of the
   user rule. Checked **before** any aggregation.
4. **Compute windows:** `now = await timeContext.getUtcNowAsync()`; `{ current, previous } =
   computePeriodComparisonWindows(now, granularity, timezone)` — timezone-aware, see §4.2/§4.4.
5. **Aggregate per period (reuse Task 7):** call `getPersonalRecordsAsync({ userId, exerciseId, from:
   current.start, to: current.end })` and the same for `previous` — run concurrently with
   `Promise.all`. Each returns a `PersonalRecordAggregate` (kg; null metrics when no data in window).
6. **Build period blocks:** convert each non-null winner to the requested unit via `fromBaseAsync`
   (reusing the exact `__toMetricAsync` logic from Task 7 — I will extract a shared private helper or
   duplicate the small mapper; a no-data period yields three `null` metrics → empty-not-error).
7. **Compute deltas** (see §4.3) per metric, on **kg**, then present the absolute in the requested unit.
8. Return `PersonalRecordComparisonDto` with `granularity`, `unit`, `current`, `previous`, `delta`.

### 4.2 Period boundaries (timezone-aware, half-open `[start, end)` as UTC instants)

`computePeriodComparisonWindows(now, granularity, timezone)` — boundaries are **local wall-clock in
`timezone`**, each converted to a UTC instant (honoring the zone offset / DST at that instant) for the
`performed_at` query. Using the tz library (§4.4), take `local = now` expressed in `timezone`:

- **week** — week starts **Monday 00:00:00 local** (ISO week). `current.start` = start-of-local-week
  (Monday 00:00 local); `current.end` = `current.start` + 1 week (local); `previous.start` =
  `current.start` − 1 week; `previous.end` = `current.start`.
- **month** — `current.start` = 1st 00:00 local of `local`'s month; `current.end` = +1 month;
  `previous.start` = −1 month; `previous.end` = `current.start`. The library normalizes year rollover
  (Dec→Jan / Jan→prior Dec).
- **year** — `current.start` = Jan 1 00:00 local; `current.end` = +1 year; `previous.start` = −1 year;
  `previous.end` = `current.start`.
- Adding/subtracting a period is **calendar arithmetic in the zone** (not fixed 7·24h / 30d), then each
  boundary is materialized to a UTC `Date`. Because the library resolves the offset at each boundary
  instant, a week/month/year spanning a DST change still yields correct UTC bounds (the day a clock
  shifts is 23h or 25h long, handled by the library — not by us).
- Each block's `periodStart` / `periodEnd` on the response are the window's UTC `start` / `end`.

### 4.3 Delta computation (per metric, on kg, converted for display)

For each metric the comparison uses the metric's primary kg scalar:
- maxWeight → `weightKg`; maxVolume → `volumeKg`; best1Rm → `oneRepMaxKg`.

Let `cur` = current kg scalar (or `null`), `prev` = previous kg scalar (or `null`). Branches:

1. **both null** → `{ absolute: null, percent: null, direction: 'same' }`.
2. **prev null, cur present** → `{ absolute: null, percent: null, direction: 'new' }` (no
   divide-by-zero; the architecture-design specifies `absolute: null` here).
3. **cur null, prev present** → `{ absolute: null, percent: null, direction: 'none' }` — the
   no-data marker (D4, human decision 2026-10-10): the metric existed last period but there is no data
   this period, so it is neither an increase, a decrease, nor "new". Distinct from both-null (`'same'`)
   and prev-null (`'new'`).
4. **both present** →
   - `absoluteKg = cur - prev`.
   - `direction`: `'same'` if `absoluteKg === 0`, else `'up'` if `> 0`, else `'down'`.
   - `percent = prev !== 0 ? round2((absoluteKg / prev) * 100) : null` (prev is a PR weight so
     `prev > 0` in practice; the guard is defensive).
   - `absolute = await fromBaseAsync(absoluteKg, unit)` — computed on kg, converted to the requested
     unit for display (2 dp; `fromBaseAsync` handles negatives correctly).

`round2(x) = Math.round(x * 100) / 100` for `percent` (D3, approved — 2 dp).

### 4.4 Timezone library (dependency decision — needs human approval)

Hand-rolled offset math is explicitly **not acceptable**, and a correct local↔UTC conversion for
arbitrary IANA zones with DST requires the tz database. Current state: **no** date/tz library is in
`package.json`; only native `Intl` (ICU is present, so `Intl.DateTimeFormat` with `timeZone` works —
used by the validator, but `Intl` alone has no clean "start of local week/month + add period → UTC
instant" API). Options evaluated:

| Library | DST / IANA | API fit for this task | Size / deps | Maintenance | Verdict |
| --- | --- | --- | --- | --- | --- |
| **luxon** | Full IANA/DST via native `Intl` (no bundled tz data) | `DateTime.fromJSDate(now,{zone}).startOf('week'\|'month'\|'year')`, `.plus/.minus({weeks/months/years:1})`, `.toJSDate()` — exactly the calendar ops needed; `startOf('week')` is Monday (ISO) | ~70 kb, zero runtime deps (leans on `Intl`) | Actively maintained, de-facto Moment successor | **Recommended** |
| date-fns-tz | Good (wraps date-fns + `Intl`) | Needs `zonedTimeToUtc` + manual `startOfWeek`/`add` composition — more glue, week-start config | small, tree-shakeable | maintained | Viable, more wiring |
| dayjs + utc + timezone plugins | Good (via `Intl`) | Plugin juggling; `startOf('week')` is locale-Sunday unless configured — easy to get wrong | tiny | maintained | Workable but footgun-prone for ISO week |

**Recommendation: `luxon`** (add `luxon` + `@types/luxon`). Rationale: its zone-aware `DateTime` with
`startOf`/`plus`/`minus`/`toJSDate` maps 1:1 onto "start of local week/month/year, step one period,
convert to UTC instant", `startOf('week')` is Monday per ISO (matches D1), it relies on the platform
`Intl`/ICU tz data (no bundled tz blob to age), and it is the most robust/maintained option with the
least custom glue — minimizing the chance of a DST bug. It stays isolated behind
`common/periods/period-boundary.ts`, so swapping it later touches one file.

> **Human approval needed** before I add the dependency. If luxon is rejected, name the preferred
> library and I will adapt the helper (the rest of the plan is library-agnostic).

---

## 5. Database impact

**None.** No new/changed table, column, index, or relationship. The period-bounded aggregation reuses
the Task 5 schema and the Task 7 `getPersonalRecordsAsync(from, to)`, served by the existing
`ix_workout_sets_user_id_exercise_id_performed_at` index (architecture §3 #6). **No change to
`docs/designs/database-diagram.txt`.**

## 6. Environment variables

**None.** No new config is read. No README / `.env.api` change.

## 6a. New dependency (pending D6 approval)

- **ADD** `luxon` (runtime) + `@types/luxon` (dev) to `package.json` via `pnpm add` — only after human
  approval (§4.4 / D6). Used solely by `common/periods/period-boundary.ts`. A short note on the
  UTC-vs-timezone boundary behavior and the required `timezone` param will be added to the README's
  feature/notes prose (not an env var).

---

## 7. Test plan (in-memory DB where persistence is exercised; FIXED injected clock throughout)

All new tests; **no existing test is modified or deleted** (Task 7's specs are untouched; the
controller spec is extended additively with a new `describe`, per unit-testing §5). Branch coverage
target ≥ 80%, every branch covered, exceptions asserted by exact type.

### 7.1 `common/periods/period-boundary.spec.ts` — `describe('computePeriodComparisonWindows')`

Fixed `now` instants (pure function). **Primary zone `Asia/Ho_Chi_Minh` (UTC+7, no DST)** so the
asserted UTC bounds differ visibly from naive UTC (local midnight = 17:00Z the prior day):
- **week, mid-week (UTC+7)** — `now = 2026-10-07T12:34:56.000Z` (Wed 19:34 local). Assert
  `current = [2026-10-04T17:00:00Z, 2026-10-11T17:00:00Z)` (Mon 00:00 +07), `previous =
  [2026-09-27T17:00:00Z, 2026-10-04T17:00:00Z)`.
- **week, near a local day boundary that crosses UTC day** — `now = 2026-10-05T16:30:00.000Z`
  (= 2026-10-05 23:30 local, still Sunday→no: Mon? pick an instant that is local-Sunday but UTC-Monday
  to prove local-not-UTC week bucketing) → assert the week bucket follows **local** Monday, not UTC.
- **month (UTC+7)** — `now = 2026-10-09Z` → `current = [2026-09-30T17:00:00Z, 2026-10-31T17:00:00Z)`
  (Oct 1 00:00 +07 → Nov 1 00:00 +07), `previous = [2026-08-31T17:00:00Z, 2026-09-30T17:00:00Z)`.
- **month, January local (year rollover, UTC+7)** — `now = 2026-01-15T00:00:00Z` (= Jan 15 07:00
  local) → `current = [2025-12-31T17:00:00Z, 2026-01-31T17:00:00Z)`, `previous = [2025-11-30T17:00:00Z,
  2025-12-31T17:00:00Z)`.
- **year (UTC+7)** — `now = 2026-06-15Z` → `current = [2025-12-31T17:00:00Z, 2026-12-31T17:00:00Z)`,
  `previous = [2024-12-31T17:00:00Z, 2025-12-31T17:00:00Z)`.
- **DST-transition zone** — `America/New_York` (DST): pick `now` in a week spanning the spring-forward
  (2026-03-08 02:00 local) and assert the week's UTC `start`/`end` reflect the **offset change** (one
  boundary at −05:00, the other at −04:00), proving the library (not hand math) handles the 23h day.
  A month case spanning a DST change (e.g. March 2026) asserting `current.start` at −05:00 and
  `current.end` at −04:00.
- **UTC zone sanity** — `timezone = 'UTC'`, `now = 2026-10-07T12:00:00Z`, week/month/year reduce to
  plain UTC calendar bounds.
- **unknown granularity** (cast an invalid value) → throws `Error` (default branch).

(Exact expected instants will be computed with the tz library during implementation and pinned as
literals.)

### 7.2 `services/personal-record-comparison/personal-record-comparison.service.spec.ts` — `describe('compareAsync')`

Stubs for user/exercise/conversion/workout services (as in the Task 7 spec) **plus a fake
`ITimeContext`** returning a pinned instant (e.g. `2026-10-07T12:00:00.000Z`). The workout stub
returns a window-keyed aggregate so current vs previous differ. Cases:

- **window boundaries passed to aggregation (per granularity, non-UTC zone)** — with the fake clock
  pinned and `timezone: 'Asia/Ho_Chi_Minh'`, assert `getPersonalRecordsAsync` was called with the
  exact UTC `from`/`to` for `current` and `previous` for `week`, `month`, and `year` (drives the helper
  integration + both calls, and proves the timezone flows through).
- **delta `up`** — cur > prev on a metric → `direction: 'up'`, positive `absolute`, correct `percent`.
- **delta `down`** — cur < prev → `direction: 'down'`, negative `absolute`, negative `percent`.
- **delta `same`** — cur === prev → `direction: 'same'`, `absolute: 0`, `percent: 0`.
- **prev null → `new`** — previous window empty for a metric, current present → `direction: 'new'`,
  `absolute: null`, `percent: null` (asserts no divide-by-zero).
- **both null → `same`/nulls** — metric absent in both windows → `direction: 'same'`, `absolute:
  null`, `percent: null`.
- **cur null, prev present → `none`** (D4) — metric present last period, absent now → `direction:
  'none'`, `absolute: null`, `percent: null`.
- **empty current period** — current window all-null metrics → `current` block has three `null`
  metrics at success (empty-not-error), deltas follow the null rules.
- **output conversion** — `unit: 'lb'` → each period's weight-scaled values and each `delta.absolute`
  converted via `fromBaseAsync`; assert `fromBaseAsync` called with the kg `absolute` (delta computed
  on kg, converted for display).
- **unknown user** → rejects `UserByIdNotFoundException`; `existsByIdAsync` (exercise) and
  `getPersonalRecordsAsync` NOT called.
- **unknown exercise** → rejects `ExerciseByIdNotFoundException`; `getPersonalRecordsAsync` NOT called
  (asserted before aggregation).
- **no static clock** — assert the fake time context's `getUtcNowAsync` is the only time source used
  (windows match the pinned instant).

### 7.3 `personal-record-api.controller.spec.ts` — ADD `describe('getComparisonAsync')`

Additive to the existing file (Task 7's `describe('getAsync')` untouched). A
`StubPersonalRecordComparisonService` returning a canned `PersonalRecordComparisonDto`:
- validates + delegates (passes `userId`/`exerciseId`/`granularity`/`unit`/`timezone` through).
- `ValidationException` when `unit` missing; when `unit` unsupported.
- `ValidationException` when `granularity` missing; when `granularity` invalid.
- `ValidationException` when `timezone` missing; when `timezone` is not a valid IANA zone (e.g.
  `'Mars/Phobos'`).
- `ValidationException` when `userId` missing / not a uuid; `exerciseId` missing / not a uuid.
- propagates `UserByIdNotFoundException` and `ExerciseByIdNotFoundException` from the service.

### 7.4 `common/schemas/timezone.joi-schema.spec.ts` — `describe('timezoneJoiSchema')`

- accepts a valid IANA zone (`'Asia/Ho_Chi_Minh'`, `'UTC'`, `'America/New_York'`).
- rejects an unknown zone (`'Mars/Phobos'`), an empty string, and a non-string (number) → validation
  error (drives the `try/catch` RangeError branch and the type branch).

### 7.5 `app/app.module.smoke.spec.ts` — ADD a bootstrap describe for the comparison route

New `describe('AppModule (bootstrap smoke) — PR comparison (F8)')` reusing the existing
`createInMemoryDataSource({ seedPersonalRecords: true })`. **To make period windows deterministic the
comparison smoke block overrides `CONTEXT__TIME`** with a fake clock pinned so that, for the probed
`timezone`, the **current month contains the 2026-10-01 / 2026-10-02 seed sets** (e.g. pin `now =
2026-10-15T00:00:00.000Z`, probe `granularity=month&timezone=Asia/Ho_Chi_Minh`; the seeded October
sets fall in the current window and the previous September window is empty). Cases:
- `GET /api/personal-record/comparison?...&granularity=month&unit=kg&timezone=Asia/Ho_Chi_Minh` → 200;
  `current` has the three PRs with correct winners/dates; `previous` metrics `null`;
  `delta.*.direction = 'new'`; `timezone` echoed in the response.
- converts to `lb` when `unit=lb`.
- 400 when `unit` omitted; 400 when `granularity` omitted/invalid; **400 when `timezone` omitted;
  400 when `timezone` is invalid** (`timezone=Mars/Phobos`).
- 404 `USER_NOT_FOUND` for unknown user; 404 `EXERCISE_NOT_FOUND` for unknown exercise.
- `/api/api/personal-record/comparison` → 404 (no double prefix).

I will also actually boot and probe the route before opening the PR (standing policy).

---

## 8. Decisions — status (updated 2026-10-10)

- **D1 — Period boundaries.** **CHANGED (human):** timezone-aware, not pure UTC. A **required
  `timezone`** IANA param drives local wall-clock boundaries converted to UTC instants (§4.2). Week
  start = **Monday 00:00 local (ISO)**. Folded in. (Needs the tz-library pick — see D6.)
- **D2 — Granularity param name/values.** **APPROVED:** `granularity` ∈ `{ 'week', 'month', 'year' }`.
- **D3 — Rounding.** **APPROVED:** `percent` and `absolute` to **2 dp**.
- **D4 — Null-direction markers.** **DECIDED (human):** both-null → `'same'`; prev-null (cur present)
  → `'new'` (null percent); **cur-null, prev-present → `'none'`** (no-data marker, null absolute/
  percent — NOT `'down'`). Folded in.
- **D5 — Delta scalar per metric.** **APPROVED:** compare `weightKg` / `volumeKg` / `oneRepMaxKg`.
- **D6 — Timezone library (NEW, needs approval).** Recommend **`luxon`** (+ `@types/luxon`); see §4.4
  for the comparison and rationale. I will not add the dependency until approved; name an alternative
  if luxon is rejected.

The architecture-design is confirmed (EXERCISE_NOT_FOUND mirror human-confirmed) and the architect is
updating it to the timezone contract in parallel. **D1 and D4 are already decided; the one open item
is D6 (the tz-library pick).** Once D6 is approved I will implement Phase 2.
