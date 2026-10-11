# Implementation Plan — Task 14: Offset list response schema documentation

- **Task:** `14. Offset list response schema documentation` — Features **F2, F3**.
- **Depends on:** Tasks 2, 3, 11, 13. Stacked on the Task 13 branch `feat/13-pagination-envelope-slimming`.
- **Type:** DOCS-ONLY (no runtime behavior change). Scope human-approved; implement directly, open one PR.

## Changes

### Create — 3 documentation DTOs (mirror `WorkoutHistorySearchResultDto`)
Each `implements SearchResult<ItemDto>`, with `@ApiProperty({ type: () => [ItemDto] }) items` and
`@ApiProperty({ required: false, type: Number }) total?` — NO `limit`/`offset`.
- `apps/api/src/modules/apis/user/dto/user-search-result.dto.ts` — `UserSearchResultDto` (items: UserDto[])
- `apps/api/src/modules/apis/exercise/dto/exercise-search-result.dto.ts` — `ExerciseSearchResultDto` (items: ExerciseDto[])
- `apps/api/src/modules/apis/muscle-group/dto/muscle-group-search-result.dto.ts` — `MuscleGroupSearchResultDto` (items: MuscleGroupDto[])

### Create — 3 specs (one per DTO, modeled on `workout-history-search-result.dto.spec.ts`)
- Each asserts keys exactly `['items','total']`, `'limit'`/`'offset'` absent, values carried through,
  compile-time conformance to `SearchResult<ItemDto>`, and the `total`-omitted branch.

### Change — 3 controllers (decorator-only: add `type:` + import; return type unchanged)
- `user-api.controller.ts` — `@ApiOkResponse({ ..., type: UserSearchResultDto })`
- `exercise-api.controller.ts` — `@ApiOkResponse({ ..., type: ExerciseSearchResultDto })`
- `muscle-group-api.controller.ts` — `@ApiOkResponse({ ..., type: MuscleGroupSearchResultDto })`

### Change — guideline doc
- `docs/guidelines/best-practices/api-documentation.md` §II — add a short convention line: list/search
  endpoints must advertise their response body via a typed `@ApiOkResponse({ type: ... })` DTO.

## Test cases covered
- Per DTO: exact keys `['items','total']`; `limit`/`offset` absent; constructor carries values;
  compile-time conformance to `SearchResult<ItemDto>`; `total` omitted → `undefined`, keys unchanged.

## Existing tests touched
- None. All additive new spec files. No existing controller/service spec needs changes (decorator
  metadata is not asserted there) — confirmed by reading the controllers.

## Database impact
- None. No schema change; DB diagram untouched.

## Environment variables
- None.

## Not changed
- Any return literal, service, Joi schema, route, status code, error shape; the cursor endpoint
  (`workout-history`) and its DTO.
