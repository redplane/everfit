# Test Plan — 1. Platform foundation

Task: plans/2026-10-05_2026-10-09/1. Platform foundation/
Feature ID(s): F1  ·  Endpoints under test: `GET /api` (liveness), `GET /api/docs` (gated Scalar UI), plus the global exception-filter behaviour on unknown routes and malformed bodies
Status: DRAFT — awaiting human approval

## Scope note (why this is not a no-op)
Task 1 introduces **no business API endpoints**. However, three behaviours are observable by an
external HTTP client and map to acceptance criteria / edge cases:
1. The scaffolded liveness route (kept, now served at `GET /api` because of the global prefix).
2. The **env-gated** OpenAPI/Scalar docs mount at `GET /api/docs` (AC-4: "API documentation is gated
   by an environment variable and defaults to off").
3. The **global exception filter** translating unknown routes / malformed input into a stable
   structured body with no stack trace (AC-2 + edge cases "unknown route → structured 404",
   "malformed JSON → structured 400, not a crash").

The remaining acceptance criteria are **not** black-box testable in this task and are covered by
unit tests and by later tasks' endpoints — see the Coverage check below.

## Observed response shapes (from the implemented filters — assert against these)
- Unhandled / not-found / body-parse errors (`UnhandledExceptionFilter`, catch-all):
  `{ "code": "UNHANDLED", "message": "An unexpected error occurred. Please try again later." }`
  with the originating HTTP status (404 for unknown route, 400 for a bad body). No `stack`, no raw
  message is leaked.
- Validation errors (`ValidationExceptionFilter`): `{ "code": "VALIDATION_ISSUE", "issues": [...] }`
  at 400 — **no endpoint exercises this yet** (see Coverage check).
- Business errors (`BusinessExceptionFilter`): `{ "code": <code>, "message": <msg> }` — no business
  endpoint yet.

## Preconditions / test data
- **No seed/reference data required** — this task creates no tables, so the PostgreSQL helper
  (`docs/guidelines/tools/database/postgres/DatabaseQuery.ps1`) was **not** needed and no DB
  inspection was performed. (Confirmed against `architecture-design.md` §Database changes: "No
  tables yet".)
- **Boot dependency:** `AppModule` wires `TypeOrmModule.forRootAsync`, so the app must be able to
  connect to PostgreSQL at boot for any scenario to run. Provide a reachable DB via
  `DATABASE__HOST/PORT/USERNAME/PASSWORD/NAME` (the `docker-compose.yml` postgres service suffices).
- **Two run configurations are required** (the docs gate is read once at bootstrap):
  - **Config A — docs ON:** start the app with `API_DOCUMENT__ENABLED=true`. Used by T2.
  - **Config B — docs OFF (default):** start the app with `API_DOCUMENT__ENABLED` unset or `=false`.
    Used by T1, T3, T4, T5, T6.
- Global prefix is `api`; the Scalar UI is mounted at the literal path `/api/docs`.

## Scenarios
| ID | Title | Precondition / data | Request | Expected result | Maps to |
|----|-------|---------------------|---------|-----------------|---------|
| T1 | Liveness responds | Config B (or A); app booted | `GET /api` | 200 · body `{ "message": "Hello API" }` | Foundation boots; kept scaffolded endpoint |
| T2 | Docs served when enabled | Config A (`API_DOCUMENT__ENABLED=true`) | `GET /api/docs` | 200 · `Content-Type: text/html` · body is the Scalar API-reference page (contains the OpenAPI title "Everfit Workout Logging API") | AC-4 (docs gated by env var — ON) |
| T3 | (neg) Docs absent by default | Config B (`API_DOCUMENT__ENABLED` unset/false) | `GET /api/docs` | 404 · body exactly `{ "code": "UNHANDLED", "message": "An unexpected error occurred. Please try again later." }` · no `stack` field | AC-4 (defaults to off); edge: structured 404 |
| T4 | (neg) Unknown route → structured 404 | Config B; app booted | `GET /api/does-not-exist` | 404 · body `{ "code": "UNHANDLED", "message": "An unexpected error occurred. Please try again later." }` · no stack trace / raw message | edge: "unknown route returns a consistent structured 404 shape"; AC-2 |
| T5 | (neg) Malformed JSON body → structured 400, no crash | Config B; app booted | `POST /api/anything` · header `Content-Type: application/json` · raw body `{ "bad": ` (invalid JSON) | 400 · structured body `{ "code": "UNHANDLED", "message": "An unexpected error occurred. Please try again later." }` · process stays up (a follow-up `GET /api` still returns 200) | edge: "malformed JSON ... returns a structured 400, not a crash"; AC-2 |
| T6 | (neg) Wrong content type → structured error, no crash | Config B; app booted | `POST /api/anything` · header `Content-Type: text/plain` · body `plain text` | A structured error body (`{ "code": "UNHANDLED", "message": "..." }`) at a 4xx status (expected 404 — route unknown) · never a raw stack trace; process stays up | edge: "wrong content type ... returns a structured [error], not a crash"; AC-2 |

All of T3–T6 are negative tests. T6 asserts the **no-crash + structured-shape** invariant rather
than a specific status, because there is no body-accepting route in this task; its value is proving
the catch-all filter and the server survive malformed/unroutable input.

## Coverage check
- **Every endpoint in this task:** `GET /api` (T1), `GET /api/docs` (T2 ON / T3 OFF) — both covered.
- **Every error response in the design that is reachable externally:** the `UNHANDLED` catch-all
  shape is covered by T3/T4/T5/T6.
  - `VALIDATION_ISSUE` (AC-1, `{code, issues[]}` at 400) is **not reachable** — no endpoint applies a
    Joi schema in this task. It is covered by `joi.service.spec.ts` (unit) and will become black-box
    testable on the first validated endpoint in tasks 2–9. **Known gap, by design.**
  - `BusinessException` shape — no business endpoint yet; deferred to later tasks. **Known gap.**
- **Acceptance criteria covered:**
  - AC-2 (global filter → structured body, never a stack trace): T4, T5, T6. **Covered.**
  - AC-4 (docs gated by env var, defaults off): T2 (on), T3 (off). **Covered.**
  - AC-1 (Joi validation → structured 400): **not externally observable here** — unit-tested only.
  - AC-3 (time from injected UTC context, deterministic): **internal DI concern, not observable via
    HTTP** — unit-tested (`time-context.spec.ts`).
  - AC-4 "no hardcoded secrets / layered config": the env-gating half is covered (T2/T3); the
    "no hardcoded secrets" half is a code/config property, not black-box observable.
- **Edge cases covered:** malformed JSON → 400 (T5); wrong content type → no crash (T6); unknown
  route → structured 404 (T4). All listed edge cases covered.

## Approval
This plan is **DRAFT — awaiting human approval**. The draft PR (#2) may be marked ready for review
(`gh pr ready 2`) **only after** a human approves this plan.
