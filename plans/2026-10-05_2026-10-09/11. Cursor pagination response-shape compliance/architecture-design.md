# Architecture Design — Task 11: Cursor pagination response-shape compliance

- **Task:** `11. Cursor pagination response-shape compliance` — Feature **F6** (compliance / cross-cutting).
- **Depends on:** Task 6 (Get workout history). Independent of Tasks 2/3 (offset lists) — they are
  only read to confirm they stay unchanged.
- **Goal:** Lock the cursor-pagination response contract so cursor-paginated endpoints return only
  `items` + cursor metadata (`limit`, `nextCursor`) and never a `total`, enforced by regression tests
  and an accurate OpenAPI/Scalar schema — not by a refactor.

Governs: `docs/guidelines/best-practices/pagination.md` (§II.2, §II.4) and
`docs/guidelines/typescript/frameworks/nestjs/api.md` §3.1.

## Investigation findings (verified against source)

- **The only cursor-paginated endpoint is `GET /api/workout-history`** (Task 6). It is **already
  compliant**:
  - `WorkoutHistoryQueryService.searchAsync` returns `{ items, limit: query.limit, nextCursor }`
    (`apps/api/src/modules/apis/workout-history/services/workout-history-query/workout-history-query.service.ts:83`).
  - The empty/filtered-to-empty path `__emptyResult(limit)` returns `{ items: [], limit, nextCursor: null }`
    (same file, line 160–162).
  - Neither path ever sets `total`. No code change to the runtime behavior is needed.
- **Offset endpoints explicitly populate `total`** and must stay unchanged:
  - `GET /api/users` — `user-api.controller.ts:43-48` (`{ items, limit, offset, total }`).
  - `GET /api/exercises` — `exercise-api.controller.ts:47-52` (`{ items, limit, offset, total }`).
  - `GET /api/muscle-groups` — `muscle-group-api.controller.ts` (same offset shape).
- **Shared wire envelope** `SearchResult<T>` (`apps/api/src/common/models/search-result.ts`) makes
  `offset?`, `total?`, and `nextCursor?` all optional on one interface — so the type system does not
  stop a cursor endpoint from leaking `total`. This is the gap the task addresses.
- **OpenAPI today advertises no response schema** for any list endpoint: every list handler uses
  `@ApiOkResponse({ description: '…' })` with **no `type`** (see `workout-history-api.controller.ts:30-32`,
  `user-api.controller.ts:32`, `exercise-api.controller.ts:30-32`). So the cursor endpoint does not
  currently advertise a shape that includes `total` — but it also does not advertise the correct
  `items + limit + nextCursor` shape. The acceptance criterion "advertises only items + nextCursor +
  limit (no total)" requires adding a documentation response DTO to the cursor endpoint.

## Database changes

- **None.** This is a response-shape/compliance task; no entities, columns, indexes, or migrations
  are touched.

## Decision — `SearchResult<T>`: type-level split vs test-only enforcement

**Recommendation: test-only enforcement. Keep the single shared `SearchResult<T>` type unchanged.**

Rationale:

1. **The guidelines mandate one shared envelope.** `pagination.md` §II.4 states: "Both styles share
   the one wire envelope `SearchResult<T>` (`src/common/models/search-result.ts`): offset lists
   populate `offset` + `total`; cursor lists populate `nextCursor` and leave `total` unset." `api.md`
   §3.1 likewise references the single `SearchResult<T>`. A type-level split (two result types or a
   discriminated union) would **contradict a governing guideline** — and the architect rule is to
   prefer the guideline unless the human decides otherwise. The task also states explicitly that the
   shared type is "not required to change … if tests already lock the behavior."
2. **Scope.** The task is "verification + locking the contract, not a refactor" (description Notes).
   A type split would touch the shared model, all three offset controllers' return typing, the
   workout-history controller + service interface, and both guideline docs — churn with no runtime
   behavior change, raising regression risk against an already-compliant endpoint.
3. **A compile-time guard is weak here anyway.** Even a split type cannot stop a plain object literal
   from carrying an extra key at the HTTP boundary once it is serialized; the authoritative guard is a
   runtime assertion on the response body. Regression tests that assert the `total` **key is absent**
   (not merely `undefined`) on every cursor path catch exactly the failure the criterion names
   ("a future regression that re-adds a count is caught").

**Optional, low-risk hardening (not a type split):** strengthen the doc comment on
`SearchResult<T>` to state the rule imperatively — change "Cursor-paginated lists populate
`nextCursor`" to "Cursor-paginated lists populate `nextCursor` and **must not** set `total`." This
documents the contract on the type without introducing a second type. This is the only change (if any)
to `search-result.ts`; the interface shape stays identical.

## API changes

- **Runtime contracts: no change.** `GET /api/workout-history` keeps returning
  `{ items, limit, nextCursor }`; the three offset endpoints keep returning `{ items, limit, offset,
  total }`. No routes, DTOs, query params, status codes, or error shapes change. Malformed cursor
  remains a 400 `ValidationException`; unknown user remains 404 `USER_NOT_FOUND`.

- **OpenAPI/Scalar schema alignment (documentation only, cursor endpoint):** add a response
  documentation DTO so Scalar advertises the exact cursor shape with no `total`:
  - New file `apps/api/src/modules/apis/workout-history/dto/workout-history-search-result.dto.ts`,
    class `WorkoutHistorySearchResultDto`:
    - `@ApiProperty({ type: () => [WorkoutHistoryItemDto] }) items: WorkoutHistoryItemDto[]`
    - `@ApiProperty({ description: 'The page size served (1..100, default 20).' }) limit: number`
    - `@ApiProperty({ nullable: true, type: String, description: 'Opaque cursor for the next page; null on the last page.' }) nextCursor: string | null`
    - **No `total`, no `offset` property.**
  - In `workout-history-api.controller.ts`, change the decorator only:
    `@ApiOkResponse({ description: '…', type: WorkoutHistorySearchResultDto })`. The handler return
    type stays `Promise<SearchResult<WorkoutHistoryItemDto>>` (structurally compatible; the DTO is
    for documentation). This is an additive decorator change, not a behavior change.

- **Offset endpoints' OpenAPI: leave as-is.** They currently advertise no schema and therefore cannot
  wrongly advertise "no total." The task says offset endpoints are "left UNCHANGED … only touched to
  confirm they stay unchanged," so this design does **not** modify the offset controllers. If the
  product-owner later wants offset schemas documented with `total`, that is a separate follow-up; flag
  it rather than editing them here.

## Environment variables

- **None.**

## Tests to define

All additions are **new `it` blocks / new files** (additive per `unit-testing.md` §5 — one `describe`
per function, same-function cases grouped). No existing `it` is edited or removed, so this task is
**ready**, not blocked.

1. **Cursor service "no total" regression guard** — extend
   `apps/api/src/modules/apis/workout-history/services/workout-history-query/workout-history-query.service.spec.ts`
   (existing `describe('searchAsync')`), adding new cases that assert the **key is absent** (not just
   `undefined`), using `expect(Object.prototype.hasOwnProperty.call(result, 'total')).toBe(false)`
   (equivalently `expect('total' in result).toBe(false)`):
   - populated page (hasMore true and false),
   - last page (`nextCursor` null),
   - known user, no rows (empty page),
   - filtered-to-empty (name/muscle-group resolves to empty id set → `__emptyResult`).
   Also assert each result still has keys `items`, `limit`, `nextCursor`.

2. **Cursor controller "no total" regression guard** — extend
   `apps/api/src/modules/apis/workout-history/workout-history-api.controller.spec.ts`
   (existing `describe('searchAsync')`), adding a case that asserts the returned body has no `total`
   key and does expose `items`/`limit`/`nextCursor`. (The stub already returns
   `{ items, limit, nextCursor }`, so this locks the controller pass-through shape.)

3. **OpenAPI/Scalar documentation-shape lock** — new file
   `apps/api/src/modules/apis/workout-history/dto/workout-history-search-result.dto.spec.ts`:
   - `describe('WorkoutHistorySearchResultDto')` — instantiate the DTO with sample
     `items`/`limit`/`nextCursor` and assert `Object.keys(instance)` equals exactly
     `['items', 'limit', 'nextCursor']` (sorted-compare) and does **not** include `total` or `offset`.
     This guards the documented schema against a regression that re-adds a count field.
   - (Optional, stronger) a swagger-document assertion: build the OpenAPI document for a module
     registering `WorkoutHistoryApiController` via `SwaggerModule.createDocument`, resolve the
     `WorkoutHistorySearchResultDto` schema from `document.components.schemas`, and assert its
     `properties` keys exclude `total`. Prefer the lightweight key-shape test above if the swagger
     wiring in a unit test proves heavy; the key-shape test already satisfies the criterion.

4. **Offset endpoints stay compliant (confirmation, optional but recommended)** — in the existing
   `user-api.controller.spec.ts` (and/or exercise/muscle-group controller specs), add a case asserting
   the offset list body **does** contain `total` (and `offset`), so the "offset keeps total" half of
   the contract is also regression-guarded. Additive `it` only; existing cases untouched.

### Existing tests that must change

- **None.** Every item above is a new `it` block in an existing spec or a brand-new spec file; no
  existing test is modified or deleted. If the developer instead chooses to rewrite/replace an
  existing `it` (rather than add alongside), that would touch an existing test and require human
  confirmation — the recommended, ready approach is strictly additive.

## Files to create/change

- **Create:** `apps/api/src/modules/apis/workout-history/dto/workout-history-search-result.dto.ts`
  (`WorkoutHistorySearchResultDto` — documentation response DTO).
- **Create:** `apps/api/src/modules/apis/workout-history/dto/workout-history-search-result.dto.spec.ts`.
- **Change (decorator only):** `apps/api/src/modules/apis/workout-history/workout-history-api.controller.ts`
  — add `type: WorkoutHistorySearchResultDto` to `@ApiOkResponse`. No logic change.
- **Change (additive tests):**
  `apps/api/src/modules/apis/workout-history/services/workout-history-query/workout-history-query.service.spec.ts`,
  `apps/api/src/modules/apis/workout-history/workout-history-api.controller.spec.ts`,
  and (optional) the offset controller specs.
- **Optional doc-comment hardening:** `apps/api/src/common/models/search-result.ts` — tighten the
  cursor line to "populate `nextCursor` and must not set `total`." No type/shape change.
- **No change:** `user-api.controller.ts`, `exercise-api.controller.ts`, `muscle-group-api.controller.ts`
  (runtime and decorators), `cursor-page.ts`, migrations, entities, the workout-history service/runtime.

## Contract

- `SearchResult<T>` (`apps/api/src/common/models/search-result.ts`) — **unchanged** interface:
  `{ items: T[]; limit: number; offset?: number; total?: number; nextCursor?: string | null }`.
  Cursor usages leave `offset`/`total` unset; offset usages leave `nextCursor` unset. Enforced by
  tests, documented by the doc comment.
- `WorkoutHistorySearchResultDto` (new) — documentation projection of the cursor response:
  `{ items: WorkoutHistoryItemDto[]; limit: number; nextCursor: string | null }`. No `total`,
  no `offset`.
- `IWorkoutHistoryQueryService.searchAsync` signature — **unchanged**
  (`Promise<SearchResult<WorkoutHistoryItemDto>>`).

## Done when

- `pnpm nx test api` passes, including the new "no `total` key" assertions on every cursor path
  (populated / last page / empty / filtered-to-empty), the controller pass-through assertion, and the
  `WorkoutHistorySearchResultDto` shape lock.
- `pnpm nx build api` succeeds.
- `GET /api/workout-history` still returns `{ items, limit, nextCursor }` (verified, no code behavior
  change); offset endpoints still return `{ items, limit, offset, total }`.
- The Scalar/OpenAPI schema for `GET /api/workout-history` advertises only `items` + `limit` +
  `nextCursor` (no `total`); offset endpoints are untouched.
- `SearchResult<T>` remains the single shared envelope (per `pagination.md` §II.4 / `api.md` §3.1);
  conventions met.
