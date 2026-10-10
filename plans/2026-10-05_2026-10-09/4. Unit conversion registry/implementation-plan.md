# Implementation Plan — Task 4: Unit conversion registry (category-based `ScaleUnit`)

- **Task:** `4. Unit conversion registry` — Feature **F4**.
- **Phase:** PLAN ONLY (no production code written yet). Awaiting approval before Phase 2.
- **Depends on:** Task 1 (platform foundation). Per the sprint linear-stacking rule, this PR stacks on
  Task 3's branch so shared cumulative files (e.g. `business-exception-codes.ts`, `app.module.ts`,
  `common/schemas/`) accumulate cleanly and the diff shows only Task 4's changes.
- **Architecture status:** `architecture-design.md` is **confirmed** ("ready", §Existing tests that
  must change). Proceeding is permitted.

## Scope summary

- **DB / diagram change:** **none.** The registry lives in code, not the DB. No entity, no migration,
  no change to `docs/designs/database-diagram.txt`.
- **API change:** **none.** This task ships **no endpoint** — it is a pure CORE module (conversion
  service + registry) consumed by Tasks 5–8, plus one reusable Joi schema. Therefore **no AppModule
  bootstrap smoke test** and **no pg-mem integration test** are required (the service is pure logic,
  no persistence). `app.module.ts` is **not** changed — the core module is imported by downstream
  consumers, not globally.
- **New environment variables:** **none.** No README / `.env.api` change.
- **New dependencies:** **none** (uses existing `joi`, `jest`; no uuid/typeorm needed — pure logic).

## Branch / PR plan

- **Branch:** `feat/4-unit-conversion-registry`, created off `feat/3-exercise-master-data`.
- **PR base:** `feat/3-exercise-master-data` (stacked — not `main`).
- **PR:** one **draft** PR. Title: `feat(scale-unit): Task 4 — unit conversion registry (category-based ScaleUnit)`.
- Body: summary, test cases covered, "DB diagram: unchanged", "env vars: none", task-folder link,
  Claude Code attribution. Left as **draft** pending reviewer + (N/A QA, no endpoint) sign-off. I do
  not mark it ready.

## Changes — files to create

All under `apps/api/src/modules/cores/scale-unit/` unless noted. One declaration per file;
`#region` banners; explicit access modifiers; `Async` suffix on Promise-returning methods.

### Constants / model / registry
1. `constants/scale-unit-categories.ts` — `enum ScaleUnitCategories { WEIGHT = 'WEIGHT' }`
   (plural-noun enum, `SNAKE_UPPER_CASE` value). `LENGTH` documented in a comment as the extension
   example, **not shipped**.
2. `constants/weight-units.ts` — `enum WeightUnits { KILOGRAM = 'kg', POUND = 'lb' }`. Values are the
   **wire codes** — the human-approved deviation from `generic.md` §2's `SNAKE_UPPER_CASE`-value rule
   (architecture.md §1), with a doc comment citing the approval so no reviewer flags it as a mistake.
3. `models/scale-unit.ts` — `interface ScaleUnit { code: string; name: string; description: string;
   category: ScaleUnitCategories; factorToBase: number }` (pure shape → `interface` per
   `generic.md` §2).
4. `constants/scale-unit-definitions.ts` — the registry. A `const` array `ScaleUnitDefinitions:
   readonly ScaleUnit[]` with the two weight units:
   - `{ code: 'kg', name: 'Kilogram', description: 'Metric base unit of mass', category: WEIGHT, factorToBase: 1 }`
   - `{ code: 'lb', name: 'Pound', description: 'Imperial unit of mass', category: WEIGHT, factorToBase: 0.45359237 }`
   Plus a **per-category base-code map** `const ScaleUnitCategoryBaseCodes: Record<ScaleUnitCategories, string>`
   = `{ [WEIGHT]: 'kg' }`, so normalization targets are config-driven, not hardcoded. The
   `factorToBase` for each category's base unit must be `1` (kg = 1).

### Exceptions (extend existing `BusinessException`; codes already declared by Task 1)
5. `exceptions/unsupported-scale-unit.exception.ts` — `UnsupportedScaleUnitException extends
   BusinessException`, code `UNSUPPORTED_SCALE_UNIT`, HTTP **400**, message naming the offending code
   (e.g. `Scale unit "stone" is not supported.`).
6. `exceptions/cross-category-conversion.exception.ts` — `CrossCategoryConversionException extends
   BusinessException`, code `CROSS_CATEGORY_CONVERSION`, HTTP **400**, message naming both codes and
   their categories (e.g. `Cannot convert between "kg" (WEIGHT) and "<x>" (LENGTH): cross-category conversion is not allowed.`).
   > `business-exception-codes.ts` already contains `UNSUPPORTED_SCALE_UNIT` and
   > `CROSS_CATEGORY_CONVERSION` (added by Task 1) — **no change** to that file.

### Service (interface-first, per `service.md`)
7. `services/scale-unit-conversion/scale-unit-conversion-service.interface.ts` —
   `IScaleUnitConversionService`:
   - `convertAsync(value: number, fromCode: string, toCode: string): Promise<number>`
   - `toBaseAsync(value: number, code: string): Promise<number>`
   - `fromBaseAsync(valueBase: number, code: string): Promise<number>` (rounded to **2 dp**)
   - `isSupported(code: string): boolean` (sync — no I/O, no Promise, so no `Async`)
   - `getCategory(code: string): ScaleUnitCategories` (sync; unknown → throws)
   - `getCodesByCategory(category: ScaleUnitCategories): string[]` (sync)
8. `services/scale-unit-conversion/scale-unit-conversion.service.ts` — `ScaleUnitConversionService
   implements IScaleUnitConversionService`, `@Injectable()`. No injected deps (pure registry lookups;
   no time, no DB). Private helper `__getDefinitionOrThrow(code): ScaleUnit` that throws
   `UnsupportedScaleUnitException` on miss — the single guard reused by `convert/toBase/fromBase/
   getCategory`. Conversion math: `convertAsync` = `__getDefinitionOrThrow(from)` +
   `__getDefinitionOrThrow(to)`; if categories differ → `CrossCategoryConversionException`; else
   `value * from.factorToBase / to.factorToBase`. `toBaseAsync` = `value * def.factorToBase`.
   `fromBaseAsync` = `round2(valueBase / def.factorToBase)` where `round2(n) =
   Math.round(n * 100) / 100`.
9. `services/scale-unit-conversion/scale-unit-conversion-injection-tokens.ts` —
   `enum ScaleUnitConversionServiceInjectionTokens { SERVICE__SCALE_UNIT_CONVERSION = 'SERVICE__SCALE_UNIT_CONVERSION' }`.
10. `services/scale-unit-conversion/scale-unit-conversion.service.module.ts` —
    `ScaleUnitConversionServiceModule`: provides `{ provide: SERVICE__SCALE_UNIT_CONVERSION,
    useClass: ScaleUnitConversionService }`, exports the token. No `TypeOrmModule`/`TimeContextModule`
    imports (none needed).
11. `scale-unit.module.ts` — `ScaleUnitModule`: `imports` + `exports`
    `[ScaleUnitConversionServiceModule]` (re-export pattern matching `ExerciseModule`), so downstream
    tasks inject `IScaleUnitConversionService` via the token.

### Reusable Joi schema (shared `common/`)
12. `apps/api/src/common/schemas/weight-unit.joi-schema.ts` —
    `export const weightUnitJoiSchema = Joi.string().valid(...<codes>)`.
    - **Implementation note / decision to surface:** a module-level `const` cannot call the *injected*
      `getCodesByCategory` service method. To honor the architecture's "codes sourced from the
      registry so the accepted set never drifts" intent while keeping the schema a static const, the
      schema derives the codes **directly from the `ScaleUnitDefinitions` registry** via a small pure
      helper (filter definitions by `WEIGHT` → map to `code`). Single source of truth preserved; no
      runtime DI needed. This is the same code set `getCodesByCategory(WEIGHT)` returns.

### File changed
- **`app.module.ts`:** none (confirmed by architecture-design §Files to create/change).

## DB / diagram / API change

- **None.** Stated explicitly: no entity, no migration, no `docs/designs/database-diagram.txt` edit,
  no endpoint, no OpenAPI change.

## Test cases to be covered

### `services/scale-unit-conversion/scale-unit-conversion.service.spec.ts`
Pure logic — **no in-memory DB needed** (no persistence). One `describe` per function. The service is
instantiated directly (`new ScaleUnitConversionService()`).

- `describe('convertAsync')`
  - kg→kg identity returns the same value (factor 1 / 1).
  - kg→lb: `1 kg → 2.2046226218...` lb (asserted via `toBeCloseTo` to sufficient precision; exact
    `1 / 0.45359237`), and a round number e.g. `0.45359237 kg → 1 lb`.
  - lb→kg: `1 lb → 0.45359237 kg` (exact factor, `toBeCloseTo`).
  - `convertAsync` does **not** round (full precision) — asserts display rounding is only in
    `fromBaseAsync` (distinguishes stored/compute precision from display precision per architecture
    §2.7 / F4).
  - unknown `fromCode` → `UnsupportedScaleUnitException` (exact type via `rejects.toBeInstanceOf`).
  - unknown `toCode` (valid `fromCode`) → `UnsupportedScaleUnitException` (covers the second guard
    branch).
  - cross-category → `CrossCategoryConversionException` (exact type). **Extensibility-seam approach,
    documented in the test:** the WEIGHT-only registry ships no second category, so the test exercises
    the cross-category branch by adding a temporary `LENGTH`-category fixture `ScaleUnit` and calling a
    convert between it and `kg`. Options evaluated — the test will use whichever keeps the production
    registry untouched: (a) construct a `ScaleUnitConversionService` seeded with a test registry that
    includes a `LENGTH` fixture (requires the service to accept its definitions via constructor — see
    decision below), or (b) if the service reads the module-level `const` registry directly,
    temporarily register a fixture and restore it in `afterEach`. **Decision to surface:** I recommend
    the service take the registry (definitions + base-code map) as an **optional constructor
    parameter defaulting to the production constants** — this is the cleanest testable seam, keeps
    production wiring unchanged (the module uses `useClass` with the default), and lets the
    cross-category branch be driven deterministically without mutating globals. If you prefer the
    service hard-reference the const registry, I will use approach (b) instead. Awaiting your call.
- `describe('toBaseAsync')`
  - kg passes through (× 1).
  - lb normalizes (× 0.45359237), e.g. `1 lb → 0.45359237 kg` (`toBeCloseTo`).
  - unknown code → `UnsupportedScaleUnitException`.
- `describe('fromBaseAsync')`
  - kg→kg (÷ 1), rounded to 2 dp.
  - kg→lb: `1 kg → 2.20` lb (asserts **2-dp display rounding** — the raw value `2.2046...` becomes
    `2.2`/`2.20`), proving display precision is applied here and not in `convertAsync`.
  - rounding boundary case (e.g. a base value that rounds up at the 3rd dp → confirms
    `Math.round(n*100)/100`).
  - unknown code → `UnsupportedScaleUnitException`.
- `describe('isSupported')`
  - true for `'kg'` and `'lb'`; false for `'stone'` / unknown (both branches).
- `describe('getCategory')`
  - returns `ScaleUnitCategories.WEIGHT` for `'kg'` and `'lb'`; unknown → `UnsupportedScaleUnitException`.
- `describe('getCodesByCategory')`
  - returns `['kg', 'lb']` for `WEIGHT`.
  - returns `[]` for a category with no registered units (covers the empty branch — using the test
    registry / a category with no entries).

### `apps/api/src/common/schemas/weight-unit.joi-schema.spec.ts`
- accepts `'kg'`.
- accepts `'lb'`.
- rejects an unknown unit (`'stone'`) with a validation error.
- rejects a non-string (e.g. `123`) — covers the `Joi.string()` branch.

**Coverage:** every `if`/guard and both exception throw-sites are driven; exceptions asserted by
**exact type**; target branch coverage **≥ 80%** (expected ~100% for this pure module). Any branch
that proves genuinely unreachable will carry an explicit comment + test-file note.

## Existing tests touched

- **None.** No existing test is modified or deleted (architecture-design confirms this).

## Decisions / items needing your confirmation

1. **Cross-category test seam (above):** my recommendation is an **optional constructor parameter**
   on `ScaleUnitConversionService` for the registry (definitions + base-code map), defaulting to the
   production constants, so the `CrossCategoryConversionException` branch is testable without a
   shipped `LENGTH` unit and without mutating module globals. Please confirm this approach vs. keeping
   the service bound to the const registry (approach b, fixture + restore).
2. **Wire-code enum deviation** (`WeightUnits.KILOGRAM = 'kg'`) is per the human-approved decision in
   architecture.md §1 — implemented with an explaining comment. Flagging so it is not read as an
   accident.

## Verification before PR (Phase 2)

- `pnpm nx test api` (green, with coverage) → `pnpm nx build api` (compiles) → `pnpm nx lint api`
  (clean). No app-boot probe needed (no endpoint). Report outputs in the final summary.
