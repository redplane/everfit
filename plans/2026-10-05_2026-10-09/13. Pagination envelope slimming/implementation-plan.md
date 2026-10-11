# Implementation Plan — Task 13: Pagination envelope slimming

- **Task:** `13. Pagination envelope slimming` — Feature **F6** follow-up (offset response-shape change).
- **Depends on:** Tasks 2, 3, 6, 11. Built on the Task 11 branch `feat/11-cursor-pagination-shape`
  (which owns the current `search-result.ts`). PR stacked on that branch.
- **Scope:** human-finalized & approved — implement directly, open one PR.

## Changes

### Model (offset only)
- `apps/api/src/common/models/search-result.ts` — slim `SearchResult<T>` from
  `{ items; limit; offset?; total? }` to **`{ items: T[]; total?: number }`** (drop `limit` and
  `offset?`); update the doc comment; keep the cross-reference to `ICursorSearchResult<T>`.
- **No change:** `cursor-search-result.ts` (`ICursorSearchResult<T>` unchanged, no rename),
  `cursor-page.ts`, `cursor-pager.ts`, `offset-pager.ts`.

### Offset controllers → return `{ items, total }`
- `user-api.controller.ts`, `exercise-api.controller.ts`, `muscle-group-api.controller.ts` — drop
  `limit`/`offset` from the returned literal; keep passing `instance.limit`/`instance.offset` INTO
  the service criteria.

### Offset core services → return `{ items, total }`
- `user.service.ts`, `exercise.service.ts`, `muscle-group.service.ts` — `searchAsync` returns
  `{ items, total }`. Service interfaces unchanged (same `Promise<SearchResult<...>>` type name).

### Specs (6) — rewrite response-body assertions, keep input/criteria assertions
- Controller specs (`user`/`exercise`/`muscle-group`): body keys exactly `['items','total']`;
  `total` present/correct; assert `'limit' in body === false` and `'offset' in body === false`;
  drop `result.limit`/`result.offset` value asserts; keep `lastSearchCriteria` input asserts;
  trim stub `searchResult` literals to `{ items, total }`. Include empty-page `{ items: [], total }`.
- Service specs (`user`/`exercise`/`muscle-group`): returned shape keys `['items','total']`; keep
  `total` = full count and paging-behavior (slice for given limit/offset input) assertions; drop
  `result.limit`/`result.offset` asserts.
- **No change** to any cursor/workout-history spec.

### Docs
- `docs/guidelines/best-practices/pagination.md` §II.1 (drop "carries limit/offset" bullet) and §II.4
  (offset bullet → `{ items, total? }`); leave cursor §II.2 and the cursor §II.4 bullet unchanged.
- `docs/guidelines/typescript/frameworks/nestjs/api.md` §3.1 — offset shape → `SearchResult<T>`
  (`items` + `total`); cursor shape left as-is.
- `docs/guidelines/typescript/generic.md` §2 — add the `I`-prefix convention note (service/DI/base-
  entity contracts are `I`-prefixed; plain data shapes are not), including the documented EXCEPTION
  that `ICursorSearchResult<T>` keeps its `I` by explicit team decision.

### Doc reconciliation
- Task 11 `architecture-design.md` — add a short pointer note that Task 13 slims `SearchResult<T>`
  to `{ items, total? }` (Task 11 stays the historical record; not rewritten).

### Not touched
- Cursor envelope & all workout-history production/spec files; query/param DTOs and Joi schemas
  (inputs still accept limit/offset/cursor); entities; migrations. Task 12 demo walkthrough is QA-owned.

## Test cases covered
- Offset controllers: `{ items, total }` body, `limit`/`offset` keys absent, `total` correct, empty
  page, input criteria still carry limit/offset.
- Offset services: `{ items, total }` shape, `total` is full count, correct slice per limit/offset.
- Cursor specs remain green and unchanged.

## Existing tests touched
- The six offset specs (confirmed in-scope by the task: response-shape assertions rewritten; input
  assertions kept). No cursor/workout-history spec touched. If any assertion outside the
  `limit`/`offset` response shape needs rewriting, stop and get human confirmation.

## Database impact
- None. No schema change; DB diagram untouched.

## Environment variables
- None.
