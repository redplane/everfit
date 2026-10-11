# Architecture Design — Task 13: Pagination envelope slimming (drop request-echo fields from the OFFSET response)

- **Task:** `13. Pagination envelope slimming` — Feature **F6** follow-up / cross-cutting
  response-shape change. Authoritative WHAT is the product-owner's `description.txt` in this folder;
  this document is the HOW and defers to it on scope.
- **Depends on:** Task 2 (User master data), Task 3 (Exercise & muscle-group master data),
  Task 6 (Get workout history), Task 11 (Cursor pagination response-shape compliance). Must be built
  after Task 11, which it directly revises. Task 12 (demo walkthrough) must be updated to match.
- **Goal:** Slim the **offset** wire envelope `SearchResult<T>` from `{ items; limit; offset?; total? }`
  to **`{ items; total? }`** — drop the request-echo `limit`/`offset` fields, keep the
  server-computed `total`. The cursor envelope is intentionally left untouched.

> **Final decisions (human-confirmed, reflected throughout):**
> 1. **Cursor envelope `ICursorSearchResult<T>` is UNCHANGED** — it stays exactly
>    `{ items; limit; nextCursor }`. `limit` is deliberately retained on the cursor envelope.
> 2. **No rename.** `ICursorSearchResult` keeps its `I` name as a deliberate, documented exception.
> 3. **Only the offset envelope is slimmed.** `SearchResult<T>` → `{ items; total? }` is the sole
>    model change. No cursor/workout-history production files change.

---

## Context — the `I`-prefix convention (why `ICursorSearchResult` is a sanctioned exception)

The codebase uses the `I` prefix **only for injectable service contracts resolved via a token**
(`service.md` §2, `generic.md` §2): `IUserService`, `IExerciseService`, `IWorkoutHistoryQueryService`,
`ITimeContext`, etc. Plain data-model interfaces under `apps/api/src/common/models/` carry **no**
prefix: `SearchResult<T>`, `CursorPage<T>`, `CursorPager`, `OffsetPager`, `ValidationIssue`.

By that rule, `ICursorSearchResult<T>` (a data-model interface) would be `CursorSearchResult<T>`. The
human **chose to keep the `I` name** — so it stands as **the one deliberate exception** to the rule.
The reviewer-drafted `I`-prefix note being added to
`docs/guidelines/typescript/generic.md` must call this out explicitly, e.g.:

> The `I` prefix is reserved for service contracts (`I<Name>Service`). Data-model/shape interfaces
> under `common/models/` take no prefix (`SearchResult`, `CursorPage`, `CursorPager`, `OffsetPager`).
> **Exception:** `ICursorSearchResult<T>` keeps the `I` prefix by explicit team decision, even though
> it is a data-model interface, not a service contract.

**Developer action:** wire this exception note into the `generic.md` `I`-prefix addition (the
reviewer owns the exact wording; the developer incorporates the exception sentence). No code rename.

---

## Database changes

- **None.** Pure wire-shape change; no entities, columns, indexes, or migrations.

## API changes (offset response bodies only)

| Endpoint | Before | After |
| --- | --- | --- |
| `GET /api/users` | `{ items, limit, offset, total }` | **`{ items, total }`** |
| `GET /api/exercises` | `{ items, limit, offset, total }` | **`{ items, total }`** |
| `GET /api/muscle-groups` | `{ items, limit, offset, total }` | **`{ items, total }`** |
| `GET /api/workout-history` | `{ items, limit, nextCursor }` | **unchanged** |

No route, query param, status code, ordering, limit bound (1..100, default 20), offset semantics, or
error shape changes. **Clients still send `limit`/`offset`/`cursor`** — only the response echo is
removed. The query/param DTOs and Joi schemas are untouched.

## Environment variables

- **None.**

---

## Enumerated impact — EVERY file (re-verified against the final scope)

### 1. Model — offset only

- **`apps/api/src/common/models/search-result.ts`** — `SearchResult<T>` →
  `{ items: T[]; total?: number }`; drop the `limit` and `offset?` properties; update the doc comment
  (remove the "limit/offset served" wording; it now carries only `items` + server-computed `total`;
  the cross-reference to the sibling `ICursorSearchResult<T>` stays).
- **No change:** `cursor-search-result.ts` (`ICursorSearchResult<T>` = `{ items; limit; nextCursor }`
  — unchanged, no rename), `cursor-page.ts`, `cursor-pager.ts`, `offset-pager.ts`,
  `validation-issue.ts`.

### 2. Offset controllers — return `{ items, total }`

- **`apps/api/src/modules/apis/user/user-api.controller.ts`** — `searchAsync` returns
  `{ items, total }` (drop `limit`/`offset` from the returned literal; keep passing
  `instance.limit`/`instance.offset` **into** the service criteria).
- **`apps/api/src/modules/apis/exercise/exercise-api.controller.ts`** — same.
- **`apps/api/src/modules/apis/muscle-group/muscle-group-api.controller.ts`** — same.

### 3. Offset core services — return `{ items, total }`

- **`apps/api/src/modules/cores/user/services/user/user.service.ts`** — `searchAsync` returns
  `{ items, total }`.
- **`apps/api/src/modules/cores/exercise/services/exercise/exercise.service.ts`** — `searchAsync`
  returns `{ items, total }`.
- **`apps/api/src/modules/cores/exercise/services/muscle-group/muscle-group.service.ts`** —
  `searchAsync` returns `{ items, total }`.
  (The three service interfaces — `user-service.interface.ts`, `exercise-service.interface.ts`,
  `muscle-group-service.interface.ts` — keep return type `Promise<SearchResult<...>>`; the **type
  name is unchanged**, only its shape. No interface signature edit needed.)

### 4. Specs — the SIX offset specs that assert the dropped fields

These carry **pre-existing behavioral assertions** on `limit`/`offset` and must be rewritten:

- `apps/api/src/modules/apis/user/user-api.controller.spec.ts` — `result.limit`/`result.offset`
  value assertions (~lines 110–112), the `searchResult` literals that include `limit`/`offset`
  (~25–27, 140), and the "includes both the total and offset keys" test (~148–161, which must become
  a "`total` key present, `limit`/`offset` keys absent" test).
- `apps/api/src/modules/apis/exercise/exercise-api.controller.spec.ts` — `result.limit`/`result.offset`
  assertions (~95–97) and `searchResult` literals (~35, 81–83, 103, 172).
- `apps/api/src/modules/apis/muscle-group/muscle-group-api.controller.spec.ts` —
  `result.limit`/`result.offset` assertions (~68–70) and `searchResult` literals (~20–22, 57–59, 98).
- `apps/api/src/modules/cores/user/services/user/user.service.spec.ts` — `result.limit`/`result.offset`
  assertions (~136–137, 172); keep the `total` assertions.
- `apps/api/src/modules/cores/exercise/services/exercise/exercise.service.spec.ts` — the returned
  `SearchResult` shape assertions.
- `apps/api/src/modules/cores/exercise/services/muscle-group/muscle-group.service.spec.ts` — same.

**Keep** every assertion that `limit`/`offset` are still passed **into** the service criteria
(`lastSearchCriteria` checks) — the input contract is unchanged; only the response-shape assertions
move.

**No change to any cursor/workout-history spec** (`workout-history-api.controller.spec.ts`,
`workout-history-query.service.spec.ts`, `workout-history-search-result.dto.spec.ts`) — the cursor
envelope is unchanged.

### 5. Guidelines

- **`docs/guidelines/best-practices/pagination.md`**:
  - **§II.1** (offset) — remove the bullet "The response also carries the `limit` and the `offset`
    it was served for." Offset now returns `items` + `total` only.
  - **§II.4** (the NestJS two-type note) — update the **offset** bullet from
    `SearchResult<T>` = `{ items, limit, offset?, total? }` to `{ items, total? }`. **Leave the
    cursor bullet unchanged** (`ICursorSearchResult<T>` = `{ items, limit, nextCursor }`).
  - **§II.2** (cursor) — **unchanged** (cursor still carries its `limit` + `nextCursor`).
- **`docs/guidelines/typescript/frameworks/nestjs/api.md`** **§3.1** (lines ~94–96) — change the
  offset shape to `SearchResult<T>` (`items` + `total`); leave the cursor shape
  `ICursorSearchResult<T>` (`items` + `limit` + `nextCursor`) as-is.
- **`docs/guidelines/typescript/generic.md`** — the reviewer-drafted `I`-prefix note is added here;
  it must include the `ICursorSearchResult` exception sentence (see "Context" section above). The
  developer wires this in.

### 6. Task 12 demo walkthrough (QA-owned) — offset samples only

- **`plans/2026-10-05_2026-10-09/12. Demo session - cursor pagination response shape/demo-walkthrough.md`**
  — update **only the offset** recorded samples and assertions to `{ items, total }` (drop
  `limit`/`offset`): the §A1 discovery table + recorded 1a JSON (~lines 103–117, incl. the empty-list
  edge 1f `{"items":[],"limit":20,"offset":0,"total":0}` → `{"items":[],"total":0}`), and §B2
  "offset endpoints stay unchanged" (~382–392) + its `jq has("offset")` check, and the §B3b/§B3
  offset-schema lines (~403, 417). **Leave all cursor samples unchanged** — the §B1 cursor steps and
  recorded B1a JSON still show `{ items, limit, nextCursor }`; the §B3a cursor-schema still shows
  `items`/`limit`/`nextCursor`. The legend lines (~74, 76) update the offset shape only. This edit is
  the QA agent's, not the developer's.

### 7. Prior design reconciliation

- **Task 11 `architecture-design.md`** states `SearchResult<T>` = `{ items, limit, offset?, total? }`.
  Add a short pointer noting Task 13 slims it to `{ items, total? }` (Task 11 stays the historical
  record of the two-envelope split; it is not rewritten — per `description.txt` Notes).
- There is **no central `docs/planning/architecture.md`** (only `docs/planning/README.md`), so the
  two guideline files in §5 are authoritative.

---

## Tests to define

Target assertions after the change (all are modifications to the six existing offset specs in §4):

- **Offset controller specs** (`user`/`exercise`/`muscle-group`): the returned body has keys
  **exactly `['items', 'total']`**; `total` present and correct; assert `limit`/`offset` keys are
  **absent** (`expect('limit' in result).toBe(false)`, `expect('offset' in result).toBe(false)`).
  Keep the `lastSearchCriteria` input assertions (`limit`/`offset` still passed into the service).
  Include the empty-page case: body exactly `{ items: [], total }`.
- **Offset service specs** (`user`/`exercise`/`muscle-group`): the returned `SearchResult` has keys
  `['items', 'total']`; `total` reflects the full count; drop the `result.limit`/`result.offset`
  assertions; keep the paging-behavior assertions (correct slice for a given `limit`/`offset` input,
  `total` is the full count beyond the page).
- **No new test files.** No cursor/workout-history spec changes.

### Existing tests that must change — confirmation status

The six offset specs in §4 assert the **values** of `limit`/`offset` on the response body today, so
this change rewrites/deletes those pre-existing assertions. **This is sanctioned:** the human
finalized Task 13's scope and the product-owner's `description.txt` acceptance criteria explicitly
mandate the new `{ items, total }` offset body, which cannot hold without these spec rewrites. The
rewrites are therefore in-scope and confirmed — the task is **ready**, not blocked. If, during
implementation, any assertion *outside* the `limit`/`offset` response-shape must be rewritten or
removed, stop and get human confirmation first.

---

## Files to create/change (summary)

- **Change (model):** `apps/api/src/common/models/search-result.ts` → `{ items, total? }`.
- **Change (offset controllers):** `user-api.controller.ts`, `exercise-api.controller.ts`,
  `muscle-group-api.controller.ts`.
- **Change (offset services):** `user.service.ts`, `exercise.service.ts`, `muscle-group.service.ts`.
- **Change (offset specs):** the six spec files in §4.
- **Change (guidelines):** `pagination.md` §II.1 + §II.4 (offset only), `api.md` §3.1 (offset only),
  `generic.md` (I-prefix note incl. the `ICursorSearchResult` exception).
- **Change (demo, QA-owned):** Task 12 `demo-walkthrough.md` — offset samples only.
- **Change (doc reconciliation):** Task 11 `architecture-design.md` pointer note.
- **No change:** `cursor-search-result.ts`, `cursor-page.ts`, `cursor-pager.ts`, `offset-pager.ts`,
  all workout-history production files and specs, the offset service interfaces (type name unchanged),
  the query/param DTOs and Joi schemas, entities, migrations.

## Contract (after this task)

- `SearchResult<T>` = `{ items: T[]; total?: number }` (offset — slimmed).
- `ICursorSearchResult<T>` = `{ items: T[]; limit: number; nextCursor: string | null }` (cursor —
  **unchanged**).
- `IUserService.searchAsync` / `IExerciseService.searchAsync` / `IMuscleGroupService.searchAsync`
  → `Promise<SearchResult<...>>` (shape slimmed; type name unchanged).

## Done when

- `pnpm nx test api` passes with offset bodies asserting keys **exactly `['items', 'total']`** and
  `limit`/`offset` keys **absent**, and the cursor specs unchanged and still green.
- `pnpm nx build api` succeeds — the slimmed `SearchResult<T>` makes re-adding `limit`/`offset` to an
  offset response a compile error.
- `GET /api/users|exercises|muscle-groups` return `{ items, total }`; `GET /api/workout-history` is
  byte-for-byte unchanged (`{ items, limit, nextCursor }`).
- `pagination.md` (§II.1/§II.4 offset), `api.md` §3.1 (offset), and the Task 12 demo offset samples
  describe the slimmed offset envelope; the cursor wording/samples are untouched. `generic.md`
  documents the `I`-prefix rule with the `ICursorSearchResult` exception. Conventions met.
