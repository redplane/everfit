# Task 14 — Offset list response schema documentation — Architecture Design

## Task

- Folder: `14. Offset list response schema documentation`
- Feature IDs: **F2, F3**
- Depends on: Task 2 (User master data), Task 3 (Exercise & muscle-group master data),
  Task 11 (Cursor pagination response-shape compliance), Task 13 (Pagination envelope slimming)

All dependencies are already delivered on the current branch (the offset envelope is already
slimmed to `{ items, total? }` in `search-result.ts`, and the cursor DTO pattern from Task 11 is
in place), so this task is ready to design against a frozen upstream.

## Goal

Give the three offset-paginated list endpoints (`GET /api/users`, `GET /api/exercises`,
`GET /api/muscle-groups`) a documented OpenAPI/Scalar 200 response schema of exactly `items`
(array of the endpoint's item DTO) + `total`, with no `limit`/`offset` — mirroring what Task 11
did for the cursor endpoint.

## Database changes

None. This task touches documentation decorators and DTO classes only.

## API changes

No new, changed, or removed routes. No change to request DTOs, Joi validation, query params,
status codes, error responses, or runtime response bodies. The only change is **decorator-level
documentation metadata**: each `@ApiOkResponse` on the three list handlers gains a `type:`.

For each endpoint the documented 200 schema becomes:

| Endpoint | Documented 200 DTO | Documented shape |
| --- | --- | --- |
| `GET /api/users` | `UserSearchResultDto` | `{ items: UserDto[]; total?: number }` |
| `GET /api/exercises` | `ExerciseSearchResultDto` | `{ items: ExerciseDto[]; total?: number }` |
| `GET /api/muscle-groups` | `MuscleGroupSearchResultDto` | `{ items: MuscleGroupDto[]; total?: number }` |

Each handler keeps its return type `Promise<SearchResult<ItemDto>>`; only the decorator changes,
e.g. `@ApiOkResponse({ description: '...', type: UserSearchResultDto })`.

## Environment variables

None.

## Design decisions

### 1. DTO approach — three concrete documentation DTOs (chosen)

NestJS Swagger cannot render a generic `SearchResult<T>` interface: generics and TS `interface`
types are erased at runtime, so there is no model for the scanner to introspect. The two viable
options are (a) a concrete DTO class per endpoint, or (b) a shared generic mixin registered with
`@ApiExtraModels` + `getSchemaPath()` and documented inline via `schema: { allOf: [...] }`.

**Chosen: option (a), one concrete DTO per endpoint**, because:

- It is exactly how the cursor side already does it (`WorkoutHistorySearchResultDto`). Consistency
  across the three offset endpoints and the one cursor endpoint is the primary goal of this task.
- The mixin/`getSchemaPath` route is heavier, defeats the "self-describing from code" intent of
  `api-documentation.md` §I (readers would see `allOf` composition instead of a named model), and
  introduces a shared abstraction that no other part of the codebase uses yet. Not justified for
  three small list DTOs.

So we add `UserSearchResultDto`, `ExerciseSearchResultDto`, `MuscleGroupSearchResultDto`, each in
its own module's `dto/` folder, mirroring the placement of `WorkoutHistorySearchResultDto`.

### 2. `implements SearchResult<ItemDto>` — yes

Each DTO `implements SearchResult<ItemDto>`, matching the cursor DTO which
`implements ICursorSearchResult<WorkoutHistoryItemDto>`. This is a compile-time guard: the
documentation model can never silently drop or retype `items`/`total` relative to the wire
envelope the controller returns. Because `SearchResult<T>` declares `total?: number`, the DTO
declares `public total?: number` so it stays structurally assignable to the interface.

Note (same caveat as the cursor DTO): `implements` does **not** catch an *added* `limit`/`offset`
field — assigning a class instance skips the excess-property check. The "no `limit`/`offset`"
protection comes from the per-DTO `Object.keys` spec below plus the fact that `SearchResult<T>`
itself has no such fields.

### 3. Controller change — decorator-only

Add `type: <...>SearchResultDto` to the existing `@ApiOkResponse` on each list handler and import
the new DTO. The return type literal and the service calls are unchanged. No behavioral code is
touched.

### 4. Tests — additive, one spec per DTO

A `*.spec.ts` beside each new DTO, modeled on `workout-history-search-result.dto.spec.ts`:
assert the instance exposes exactly `items` + `total` and that `limit`/`offset` are absent, plus a
compile-time conformance line against `SearchResult<ItemDto>`. These are **new** test files, so no
existing-test-change gate applies.

Existing controller/service specs are **unchanged**: runtime behavior and return shapes are
identical, and the new decorator metadata is not asserted by those specs. (Confirmed by reading
the controllers — only the `@ApiOkResponse` option object changes.)

### 5. Guideline doc note

`docs/guidelines/best-practices/api-documentation.md` currently covers Scalar, the env toggle,
domain grouping, titles, and permissions, but has **no explicit "every list endpoint must
advertise its response DTO via a typed `@ApiOkResponse`" rule**. This task exposes that the rule
is implicit. Recommendation (flag to product-owner / human, do not change silently): add a short
convention line to `api-documentation.md` §II stating that list/collection endpoints must document
their response body with a concrete response DTO (`type:` on `@ApiOkResponse`), not a description
only. This is a documentation-guideline suggestion, not required to complete Task 14; left to
human confirmation.

## Files to create

- `apps/api/src/modules/apis/user/dto/user-search-result.dto.ts`
- `apps/api/src/modules/apis/user/dto/user-search-result.dto.spec.ts`
- `apps/api/src/modules/apis/exercise/dto/exercise-search-result.dto.ts`
- `apps/api/src/modules/apis/exercise/dto/exercise-search-result.dto.spec.ts`
- `apps/api/src/modules/apis/muscle-group/dto/muscle-group-search-result.dto.ts`
- `apps/api/src/modules/apis/muscle-group/dto/muscle-group-search-result.dto.spec.ts`

## Files to change

- `apps/api/src/modules/apis/user/user-api.controller.ts`
  — import `UserSearchResultDto`; add `type: UserSearchResultDto` to the `searchAsync`
  `@ApiOkResponse`.
- `apps/api/src/modules/apis/exercise/exercise-api.controller.ts`
  — import `ExerciseSearchResultDto`; add `type: ExerciseSearchResultDto` to the `searchAsync`
  `@ApiOkResponse`.
- `apps/api/src/modules/apis/muscle-group/muscle-group-api.controller.ts`
  — import `MuscleGroupSearchResultDto`; add `type: MuscleGroupSearchResultDto` to the `searchAsync`
  `@ApiOkResponse`.

## Contract

Each DTO follows the `WorkoutHistorySearchResultDto` pattern (class, `@ApiProperty` per field,
`implements` the envelope interface). Signature to implement (shown for the user DTO; the other
two are identical with their own item DTO and descriptions):

```ts
// user-search-result.dto.ts
export class UserSearchResultDto implements SearchResult<UserDto> {
  @ApiProperty({ description: 'The page of users.', type: () => [UserDto] })
  public items: UserDto[];

  @ApiProperty({
    required: false,
    type: Number,
    description: 'Total count of all matching rows (server-computed).',
  })
  public total?: number;

  public constructor(items: UserDto[], total?: number) { /* assigns fields */ }
}
```

- `items` uses the lazy array form `type: () => [ItemDto]`, matching the cursor DTO, to avoid
  import-order/circular pitfalls in the Swagger scanner.
- `total` is documented as optional (`required: false`) to match the `total?: number` of
  `SearchResult<T>`; no `limit`/`offset` properties exist on the class.
- `SearchResult` imported from `apps/api/src/common/models/search-result.ts`; item DTOs imported
  from each module's own `dto/*.dto.ts`.

Equivalent DTOs:
- `ExerciseSearchResultDto implements SearchResult<ExerciseDto>` with `items: ExerciseDto[]`.
- `MuscleGroupSearchResultDto implements SearchResult<MuscleGroupDto>` with `items: MuscleGroupDto[]`.

## Tests to define

- `apps/api/src/modules/apis/user/dto/user-search-result.dto.spec.ts`
  - `describe('constructor')`:
    - exposes exactly `items` + `total`; `'limit' in instance` is `false` and
      `'offset' in instance` is `false` (`Object.keys(instance).sort()`).
    - carries the provided `items`/`total` values through.
    - compile-time conformance: assign the instance to `SearchResult<UserDto>`.
    - (optional branch) construct with `total` omitted → `total` is `undefined`, keys still exclude
      `limit`/`offset`.
- `apps/api/src/modules/apis/exercise/dto/exercise-search-result.dto.spec.ts` — same, with `ExerciseDto`.
- `apps/api/src/modules/apis/muscle-group/dto/muscle-group-search-result.dto.spec.ts` — same, with `MuscleGroupDto`.

Each spec builds a sample item DTO (via the item DTO constructor / `fromEntity` as the existing
item specs do) and covers every constructor branch (≥80% branch coverage, one `describe` per
function), per `best-practices/unit-testing.md`.

### Existing tests that must change

None. All test work is additive (new files only). No existing spec is modified or deleted, so no
BLOCKED gate applies.

## Done when

- The three new DTOs and their specs exist; the three controllers pass `type:` to their
  `@ApiOkResponse`.
- `pnpm nx test api` passes; `pnpm nx build api` succeeds; `pnpm nx lint api` is clean.
- OpenAPI/Scalar shows a named 200 response schema of `items` + `total` (no `limit`/`offset`) for
  all three offset list endpoints; the cursor endpoint `GET /api/workout-history` is untouched.
- Runtime response bodies of all three endpoints are byte-for-byte unchanged (docs-only change).
```

## Status: READY (docs-only, no BLOCKED gate)
