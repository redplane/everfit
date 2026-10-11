# Implementation Plan — Task 11: Cursor pagination response-shape compliance

- **Task:** `11. Cursor pagination response-shape compliance` — Feature **F6** (compliance / cross-cutting).
- **Depends on:** Task 6 (Get workout history). Offset lists (Tasks 2/3) are read-only here.
- **Phase:** PLAN ONLY (no code until approved).
- **Design status:** `architecture-design.md` is confirmed (not BLOCKED). Approach = test-only
  enforcement + additive documentation DTO + `@ApiOkResponse({ type })`, no `SearchResult<T>` split.

## Audit results (verified against source)

| Endpoint | Style | Returns `total`? | Source | Verdict |
|---|---|---|---|---|
| `GET /api/workout-history` | cursor | **No** (`{ items, limit, nextCursor }`) | `workout-history-query.service.ts:83` happy path; `:160-162` `__emptyResult` | COMPLIANT |
| `GET /api/users` | offset | Yes (`{ items, limit, offset, total }`) | `user-api.controller.ts:43-48` | COMPLIANT (must stay) |
| `GET /api/exercises` | offset | Yes (`{ items, limit, offset, total }`) | `exercise-api.controller.ts:47-52` | COMPLIANT (must stay) |
| `GET /api/muscle-groups` | offset | Yes (`{ items, limit, offset, total }`) | `muscle-group-api.controller.ts:43-48` | COMPLIANT (must stay) |

- The only cursor endpoint is `GET /api/workout-history`. Both code paths that build a
  `SearchResult` — the keyset happy path (line 83) and `__emptyResult(limit)` (line 160-162) — return
  exactly `{ items, limit, nextCursor }` and never set `total`. The last-page path differs only in
  `nextCursor` being `null`, still no `total`. **Confirmed compliant on all four paths** (happy /
  last page / empty known-user / filtered-to-empty).
- `SearchResult<T>` (`common/models/search-result.ts`) is a single interface with `offset?`,
  `total?`, `nextCursor?` all optional — so the type system does not prevent a cursor response from
  leaking `total`. This is the gap the task locks via tests.
- OpenAPI: every list handler uses `@ApiOkResponse({ description })` with **no `type`** today, so no
  list endpoint advertises any body schema. The cursor endpoint therefore does not wrongly advertise
  `total`, but it also does not advertise the correct `items + limit + nextCursor` shape — which the
  acceptance criterion requires adding.

**Verdict: no violations found. No runtime code change is needed.** The deliverable is to lock the
contract with regression tests and add an accurate documentation schema to the cursor endpoint.

## Changes

Branch: `feat/11-cursor-pagination-shape`, stacked on the Task 6 branch if it is unmerged, else off
`main`. (Check `git branch` / PR state at implementation time; Task 6 appears already merged, so the
likely base is `main` — confirm before opening the PR.) One draft PR for this task.

### Create

1. `apps/api/src/modules/apis/workout-history/dto/workout-history-search-result.dto.ts`
   — `WorkoutHistorySearchResultDto` (documentation response projection of the cursor shape):
   - `@ApiProperty({ type: () => [WorkoutHistoryItemDto] }) items: WorkoutHistoryItemDto[]`
   - `@ApiProperty({ description: 'The page size served (1..100, default 20).' }) limit: number`
   - `@ApiProperty({ nullable: true, type: String, description: 'Opaque cursor for the next page; null on the last page.' }) nextCursor: string | null`
   - **No `total`, no `offset`.** Constructor matching the neighbouring DTO idiom (`WorkoutHistoryItemDto`).
   - This DTO is for documentation only; the handler keeps returning `SearchResult<WorkoutHistoryItemDto>`
     (structurally compatible superset).

### Change

2. `apps/api/src/modules/apis/workout-history/workout-history-api.controller.ts`
   — **decorator only:** add `type: WorkoutHistorySearchResultDto` to the existing `@ApiOkResponse`
   (keep the current `description`). Import the new DTO. No logic / return-type change.

3. `apps/api/src/common/models/search-result.ts` — **doc-comment hardening only (no shape change):**
   tighten the cursor line to state the rule imperatively, e.g. "Cursor-paginated lists populate
   `nextCursor` and **must not** set `total`." Interface members unchanged. (Low-risk; keeps the
   single shared envelope per `pagination.md` §II.4 / `api.md` §3.1.)

### Not changed (confirmed, no edit)

- `user-api.controller.ts`, `exercise-api.controller.ts`, `muscle-group-api.controller.ts` — runtime
  and decorators left as-is (offset endpoints stay `{ items, limit, offset, total }`).
- `workout-history-query.service.ts` and its runtime, cursor codec, entities, migrations.

## Test cases that will be covered

All additive — new `it` blocks in existing `describe('searchAsync')` or brand-new spec files. No
existing `it` is edited or deleted.

### A. New file — `workout-history-search-result.dto.spec.ts`
`describe('WorkoutHistorySearchResultDto')`:
- `it('exposes exactly items, limit, nextCursor and no total/offset')` — instantiate with sample
  `items`/`limit`/`nextCursor`; assert `Object.keys(instance).sort()` equals
  `['items', 'limit', 'nextCursor'].sort()`; assert `'total' in instance` is `false` and
  `'offset' in instance` is `false`.
- `it('carries the provided values through')` — assert the constructor assigns each field.

### B. `workout-history-query.service.spec.ts` (extend existing `describe('searchAsync')`)
Add "no `total` key" regression guards asserting the **key is absent** via
`expect('total' in result).toBe(false)` (equivalently `Object.prototype.hasOwnProperty.call`), plus
`expect('items' in result && 'limit' in result && 'nextCursor' in result).toBe(true)`:
- populated page, `hasMore: true` (nextCursor set) — no `total`.
- populated page, `hasMore: false` / last page (nextCursor null) — no `total`.
- known user, no rows (empty page) — no `total`.
- filtered-to-empty (name/muscle-group resolves to empty id set → `__emptyResult`) — no `total`.

### C. `workout-history-api.controller.spec.ts` (extend existing `describe('searchAsync')`)
- `it('returns a body with no total key and exposes items/limit/nextCursor')` — set the stub result
  to `{ items, limit, nextCursor }`, call `searchAsync`, assert `'total' in result` is `false` and
  the three expected keys are present (locks the controller pass-through shape).

### D. Offset-endpoint confirmation (recommended, additive)
In `user-api.controller.spec.ts` (and optionally exercise / muscle-group controller specs), add a
case asserting the offset body **does** contain `total` and `offset`, locking the "offset keeps
total" half of the contract. Additive `it` only; existing cases untouched. (Will confirm these spec
files exist at implementation time; if an offset controller spec is missing, I will note it rather
than create a large new harness unless it is trivial.)

## Existing tests touched

**None.** Every item is a new `it` in an existing spec or a new spec file. If, during
implementation, any existing test would need modification, I will stop and request approval
(architect flag + human confirm) before editing it — per the test-change gate.

## Database impact

**None.** No entity, column, index, relationship, or migration changes. `docs/designs/database-diagram.txt`
is **not** touched by this task.

## Environment variables

**None.** No new config; `README.md` / `.env.api` unchanged.

## Verification (Phase 2 gates)

- `pnpm nx test api` (with coverage) — green, including all new "no `total`" assertions; branch
  coverage ≥ 80%.
- `pnpm nx build api` — compiles.
- `pnpm nx lint api` — no new lint.
- Then open **one draft PR** (`gh pr create --draft`), base = Task 6 branch if unmerged else `main`,
  title referencing Task 11, body summarizing changes + test cases + "no DB-diagram change" +
  "no new env vars" + task-folder link + attribution. Leave as draft (review + QA gates own ready).
