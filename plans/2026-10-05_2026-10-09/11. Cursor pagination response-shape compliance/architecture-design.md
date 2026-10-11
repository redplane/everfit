# Architecture Design — Task 11: Cursor pagination response-shape compliance

- **Task:** `11. Cursor pagination response-shape compliance` — Feature **F6** (compliance / cross-cutting).
- **Depends on:** Task 6 (Get workout history). Independent of Tasks 2/3 (offset lists) — they are
  only read to confirm they stay unchanged.
- **Goal:** Give cursor-paginated endpoints a **dedicated** response type `ICursorSearchResult<T>`
  that carries only `items` + cursor metadata (`limit`, `nextCursor`) and structurally **cannot**
  carry `total`/`offset`, so the "no total" contract is enforced at the type level (not only by
  tests) with an accurate OpenAPI/Scalar schema.

Governs: `docs/guidelines/best-practices/pagination.md` (§II.2, §II.4) and
`docs/guidelines/typescript/frameworks/nestjs/api.md` §3.1 — both of which this task **updates** (see
"Guideline updates / reversal" below).

## Investigation findings (verified against source)

- **`ICursorSearchResult<T>` does NOT exist.** A repo-wide grep for `ICursorSearchResult`,
  `CursorSearchResult`, and `CursorPage` finds no cursor *result* type. What exists today under
  `apps/api/src/common/models/` is:
  - `search-result.ts` → `SearchResult<T>` = `{ items: T[]; limit: number; offset?: number; total?: number; nextCursor?: string | null }`
    — **one envelope that mixes offset and cursor fields** (all optional). This is the shape the
    cursor endpoint currently (ab)uses.
  - `cursor-page.ts` → `CursorPage<T>` = `{ items: T[]; hasMore: boolean }` — the **internal
    data-access** page returned by the core `WorkoutService.searchHistoryAsync` (derived from
    fetching `limit + 1` rows). This is NOT the wire shape; the orchestration service turns `hasMore`
    into `nextCursor`. It stays as-is.
  - `cursor-pager.ts` → `CursorPager` = `{ limit: number; cursor?: string }` — the keyset **input**.
    Unchanged.
  - `offset-pager.ts` → `OffsetPager` = `{ limit: number; offset: number }` — offset **input**.
    Unchanged.
- **The only cursor-paginated endpoint is `GET /api/workout-history`** (Task 6). Its runtime output
  is already `{ items, limit, nextCursor }` with no `total`:
  - `WorkoutHistoryQueryService.searchAsync` returns `{ items, limit: query.limit, nextCursor }`
    (`.../workout-history-query/workout-history-query.service.ts:83`).
  - `__emptyResult(limit)` returns `{ items: [], limit, nextCursor: null }` (same file, 160–162).
  - Both are **typed as `SearchResult<WorkoutHistoryItemDto>`** today, which is exactly the leak this
    task closes: the type permits `total`/`offset`.
- **Offset endpoints populate `total` + `offset`** and must stay unchanged:
  `GET /api/users` (`user-api.controller.ts:43-48`), `GET /api/exercises`
  (`exercise-api.controller.ts:47-52`), `GET /api/muscle-groups`. None reference `nextCursor`.
- **A documentation DTO already exists.** The developer created
  `apps/api/src/modules/apis/workout-history/dto/workout-history-search-result.dto.ts`
  (`WorkoutHistorySearchResultDto` = `{ items, limit, nextCursor }`) plus its spec. It is correct in
  shape but is currently documented as "the controller returns the shared `SearchResult<T>` envelope
  (structurally compatible)". This task re-bases it onto `ICursorSearchResult<T>`.

## Database changes

- **None.** Response-shape/compliance task; no entities, columns, indexes, or migrations touched.

## Decision — introduce `ICursorSearchResult<T>` and split the envelope (REVERSES the prior design)

**The prior version of this design chose "test-only enforcement, keep the single shared
`SearchResult<T>`." This is now reversed: introduce a dedicated `ICursorSearchResult<T>` and make
`SearchResult<T>` offset-only.**

Why the reversal is the better call:

1. **Compile-time safety beats a test-only guard.** With a dedicated type whose only keys are
   `items` / `limit` / `nextCursor`, a cursor result **cannot** be given a `total` without a
   TypeScript error at the source (object literal excess-property check + the service/controller
   return type). The prior design admitted its own weakness ("a compile-time guard is weak… the
   authoritative guard is a runtime assertion"); that weakness only existed *because* the single
   envelope left `total?` present. Removing `total` from the cursor type removes the failure mode
   entirely. Regression tests remain as defence-in-depth, but correctness no longer *depends* on
   them.
2. **It expresses the domain honestly.** `pagination.md` §II.1–II.3 (the approved core rule) says
   offset and cursor are two different shapes. Modelling them as one `SearchResult<T>` with four
   optional fields is the "mixes offset+cursor fields" smell the task feedback calls out. Two
   interfaces — `SearchResult<T>` (offset) and `ICursorSearchResult<T>` (cursor) — make each style
   carry exactly its meaningful metadata, which is the literal goal in `pagination.md` §I.
3. **The scope is small and the runtime is unchanged.** The cursor endpoint already *returns*
   `{ items, limit, nextCursor }`; this change only *re-types* that value and splits one `.ts` model.
   No route, DTO field, query param, status code, ordering, limit bound, or error shape changes.

Sibling-consistency note (flag, not a blocker): existing **data-model** interfaces in
`common/models/` carry **no `I` prefix** (`SearchResult`, `CursorPage`, `CursorPager`,
`OffsetPager`); the `I` prefix in this codebase is used for **service** contracts (`IUserService`,
per `service.md` §2). The task feedback explicitly names the type `ICursorSearchResult<T>`, so this
design uses that exact name as directed. If the team prefers strict sibling-consistency with
`SearchResult<T>`, the alternative name is `CursorSearchResult<T>` (same shape, same file). Decide at
review; the design below assumes `ICursorSearchResult<T>`.

## The interface (new) + the split

**New file** `apps/api/src/common/models/cursor-search-result.ts` (one declaration per file,
`generic.md` §1):

```ts
/**
 * The wire envelope for a CURSOR (keyset) paginated list response. It carries ONLY the page of
 * `items`, the `limit` it was served for, and `nextCursor` (null on the last page). It has NO
 * `total`/`offset` by construction — see docs/guidelines/best-practices/pagination.md §II.2-3.
 * Offset/page lists use the sibling `SearchResult<T>` instead.
 */
export interface ICursorSearchResult<T> {
  //#region Properties
  items: T[];
  limit: number;
  nextCursor: string | null;
  //#endregion
}
```

**Changed file** `apps/api/src/common/models/search-result.ts` — `SearchResult<T>` becomes
**offset-only**: drop the `nextCursor?` property and update the doc comment. Keep `offset?`/`total?`
optional (the three offset controllers already populate both; no controller change is required and
keeping them optional avoids churn):

```ts
/**
 * The wire envelope for an OFFSET/page-paginated list response: the page of `items`, the `limit`
 * and `offset` served, and the `total` count of all matching rows. Cursor (keyset) lists use the
 * sibling `ICursorSearchResult<T>` instead — see docs/guidelines/best-practices/pagination.md §II.4.
 */
export interface SearchResult<T> {
  //#region Properties
  items: T[];
  limit: number;
  offset?: number;
  total?: number;
  //#endregion
}
```

## API changes

- **Runtime contracts: no change.** `GET /api/workout-history` still returns
  `{ items, limit, nextCursor }`; the three offset endpoints still return
  `{ items, limit, offset, total }`. No routes, query params, status codes, or error shapes change.
  Malformed cursor remains 400 `ValidationException`; unknown user remains 404
  (`UserByIdNotFoundException`, `USER_NOT_FOUND`).

- **Return types re-based onto `ICursorSearchResult<T>`** (type-level only):
  - `IWorkoutHistoryQueryService.searchAsync`:
    `Promise<SearchResult<WorkoutHistoryItemDto>>` → `Promise<ICursorSearchResult<WorkoutHistoryItemDto>>`.
  - `WorkoutHistoryQueryService.searchAsync` and `__emptyResult` return
    `ICursorSearchResult<WorkoutHistoryItemDto>` (bodies unchanged — `{ items, limit, nextCursor }`
    already conforms). Swap the `SearchResult` import for `ICursorSearchResult`.
  - `WorkoutHistoryApiController.searchAsync` handler return type →
    `Promise<ICursorSearchResult<WorkoutHistoryItemDto>>`. Swap the import.

- **OpenAPI/Scalar documentation DTO** (`WorkoutHistorySearchResultDto`): already shaped
  `{ items, limit, nextCursor }`. Make it `implements ICursorSearchResult<WorkoutHistoryItemDto>`
  (compile-time conformance to the contract) and update its doc comment to reference
  `ICursorSearchResult<T>` instead of "the shared `SearchResult<T>` envelope". The
  `@ApiOkResponse({ …, type: WorkoutHistorySearchResultDto })` decorator on the controller is already
  in place and stays — no `total`/`offset` property is advertised.

- **Offset endpoints: leave as-is** (runtime and decorators). They keep returning
  `SearchResult<T>` with `offset` + `total`. Task scope: offset endpoints are only touched to confirm
  they stay unchanged.

## Guideline updates / reversal

Introducing a second envelope contradicts the current wording of two guideline notes, so those notes
must be updated as part of this task (they are implementation notes, **not** the approved core rule
in `pagination.md` §II.1–II.3, which is unchanged and is in fact enforced *more* strictly here):

- `docs/guidelines/best-practices/pagination.md` **§II.4** ("Note for this NestJS project"): change
  "Both styles share the one wire envelope `SearchResult<T>`…" to: offset lists use
  `SearchResult<T>` (`items` + `limit` + `offset` + `total`); cursor lists use
  `ICursorSearchResult<T>` (`items` + `limit` + `nextCursor`, no `total`/`offset`), both under
  `src/common/models/`.
- `docs/guidelines/typescript/frameworks/nestjs/api.md` **§3.1**: adjust the list/search REST shape
  note so cursor lists are described as returning `ICursorSearchResult<T>` and offset lists
  `SearchResult<T>`.

These two doc edits are the explicit reversal of the earlier "single shared envelope" decision.
Because they revise an approved convention note, confirm them at review (see Handoff).

## Environment variables

- **None.**

## Tests to define

Per `unit-testing.md` (every branch, exact exception type, in-memory/stubbed deps, one `describe`
per function). All runtime assertions below are additive; the only edits to pre-existing specs are
mechanical type-import swaps (same runtime shape).

1. **Cursor service "no total" + type guard** — in the existing
   `.../workout-history-query/workout-history-query.service.spec.ts` (existing
   `describe('searchAsync')`), add cases asserting the result has keys exactly
   `['items', 'limit', 'nextCursor']` and the `total` **key is absent**
   (`expect('total' in result).toBe(false)` and `expect('offset' in result).toBe(false)`), across:
   populated page (`hasMore` true and false), last page (`nextCursor` null), known user with no rows
   (empty page), and filtered-to-empty (`__emptyResult`). No existing `it` is removed; the
   local `page: CursorPage<…>` stub is unchanged.
2. **DTO conformance + shape lock** — in the existing
   `.../dto/workout-history-search-result.dto.spec.ts`, keep the existing key-shape assertions and
   add a compile-time conformance line (assign the instance to an
   `ICursorSearchResult<WorkoutHistoryItemDto>` typed variable) so a future field addition breaks the
   build. Confirm `Object.keys(instance)` is exactly `['items', 'limit', 'nextCursor']`.
3. **Controller pass-through** — the existing
   `workout-history-api.controller.spec.ts` stub already returns `{ items, limit, nextCursor }`; keep
   its "no total" body assertion. Its import/typing updates are covered under "Existing tests that
   must change" below.
4. **Offset endpoints stay compliant (confirmation, recommended)** — in `user-api.controller.spec.ts`
   (and/or exercise/muscle-group specs), add an additive `it` asserting the offset body **does**
   contain `total` and `offset`. Existing cases untouched.

### Existing tests that must change

- `apps/api/src/modules/apis/workout-history/workout-history-api.controller.spec.ts` — lines 7, 14,
  20 import and use `SearchResult<WorkoutHistoryItemDto>` for the stub `result` field and the stub
  method return type. These must swap to `ICursorSearchResult<WorkoutHistoryItemDto>`. **Runtime
  shape is identical** (`{ items: [], limit: 20, nextCursor: null }`); it is a type-import change
  only, required by the return-type re-base.
- `apps/api/src/modules/apis/workout-history/dto/workout-history-search-result.dto.spec.ts` — add the
  conformance assertion in item 2 (additive; no existing assertion removed).
- `apps/api/src/modules/apis/workout-history/services/workout-history-query/workout-history-query.service.spec.ts`
  — optional: the test description string on line 124 says "returns a SearchResult…"; may be reworded
  to "cursor search result". Not required for correctness.

All three files are **Task 11's own deliverables** (the DTO + its spec were created in this task; the
controller/service specs are being extended by this task), and every change is either additive or a
mechanical type-import swap with identical runtime behavior — **no pre-existing behavioral assertion
is modified or deleted.** On that basis this task is **ready**, not blocked. If, at implementation,
any assertion that predates Task 11 must actually be rewritten or removed, stop and get human
confirmation first.

## Files to create/change

- **Create:** `apps/api/src/common/models/cursor-search-result.ts` (`ICursorSearchResult<T>`).
- **Change:** `apps/api/src/common/models/search-result.ts` — drop `nextCursor?`, update doc comment
  (offset-only). No change to the three offset controllers.
- **Change:** `.../workout-history/services/workout-history-query/workout-history-query-service.interface.ts`
  — return `Promise<ICursorSearchResult<WorkoutHistoryItemDto>>`; swap import.
- **Change:** `.../workout-history/services/workout-history-query/workout-history-query.service.ts`
  — return `ICursorSearchResult<…>` from `searchAsync` + `__emptyResult`; swap import. Bodies
  unchanged.
- **Change:** `.../workout-history/workout-history-api.controller.ts` — handler return type to
  `Promise<ICursorSearchResult<WorkoutHistoryItemDto>>`; swap import. `@ApiOkResponse` already set.
- **Change:** `.../workout-history/dto/workout-history-search-result.dto.ts` — add
  `implements ICursorSearchResult<WorkoutHistoryItemDto>`; update doc comment.
- **Change (tests):** `workout-history-query.service.spec.ts`,
  `workout-history-api.controller.spec.ts`, `workout-history-search-result.dto.spec.ts`, and
  (recommended) the offset controller specs — per "Tests to define".
- **Change (guidelines):** `docs/guidelines/best-practices/pagination.md` §II.4 and
  `docs/guidelines/typescript/frameworks/nestjs/api.md` §3.1 — per "Guideline updates / reversal".
- **No central `docs/planning/architecture.md` exists** (only `docs/planning/README.md`), so no
  central design doc needs reconciling; the two guideline files above are the authoritative notes to
  update.
- **No change:** `user-api.controller.ts`, `exercise-api.controller.ts`,
  `muscle-group-api.controller.ts` (runtime + decorators), `cursor-page.ts`, `cursor-pager.ts`,
  `offset-pager.ts`, entities, migrations, the workout-history runtime behavior.

## Contract

- `ICursorSearchResult<T>` (new, `apps/api/src/common/models/cursor-search-result.ts`):
  `{ items: T[]; limit: number; nextCursor: string | null }`. No `total`, no `offset`.
- `SearchResult<T>` (changed, offset-only):
  `{ items: T[]; limit: number; offset?: number; total?: number }`. No `nextCursor`.
- `IWorkoutHistoryQueryService.searchAsync(query): Promise<ICursorSearchResult<WorkoutHistoryItemDto>>`.
- `WorkoutHistorySearchResultDto implements ICursorSearchResult<WorkoutHistoryItemDto>` —
  documentation projection: `{ items: WorkoutHistoryItemDto[]; limit: number; nextCursor: string | null }`.

## Done when

- `pnpm nx test api` passes, including the cursor "no `total`/`offset` key" assertions on every
  cursor path (populated / last page / empty / filtered-to-empty), the DTO conformance + shape lock,
  the controller pass-through, and the offset "keeps total+offset" confirmation.
- `pnpm nx build api` succeeds — importantly, `ICursorSearchResult<T>` having no `total`/`offset`
  means any attempt to add one to a cursor result is a **compile error**, not just a test failure.
- `GET /api/workout-history` still returns `{ items, limit, nextCursor }`; offset endpoints still
  return `{ items, limit, offset, total }` (no runtime behavior change).
- The Scalar/OpenAPI schema for `GET /api/workout-history` advertises only `items` + `limit` +
  `nextCursor`.
- `pagination.md` §II.4 and `api.md` §3.1 describe the two-type split. Conventions met.
