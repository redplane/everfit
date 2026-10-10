# Architecture Design — Task 4: Unit conversion registry (category-based `ScaleUnit`)

- **Task:** `4. Unit conversion registry` — Feature **F4**.
- **Depends on:** Task 1 (Platform foundation). Independent of Tasks 2 and 3 (parallelizable).
- **Goal:** Define units **organized by category** in one in-code registry behind an injectable,
  category-aware conversion service, so storage stays normalized (kg for the weight category),
  conversion is only ever valid within a category, and adding a unit — or a whole new category — is a
  minimal, localized change. This sprint only the weight category (kg, lb) is used.

See `architecture.md` §1 (resolved wire-code decision), §5 (error codes), §6 (the `ScaleUnit` model).

## Database changes

- **None.** The registry lives in code, not the DB (resolved decision). The `workout_sets.unit` /
  `weight_kg` columns are created by Task 5. `unit` stores the wire code (`'kg'`/`'lb'`) the coach
  sent; `weight_kg` stores the normalized weight-category base value.

## API changes

- **None directly.** This task ships no endpoint; it provides the conversion service and the reusable
  `weightUnitJoiSchema` consumed by Tasks 5–8. Boundary behavior:
  - Invalid/unsupported unit at a request boundary → 400 `VALIDATION_ISSUE` (Joi).
  - Unsupported unit reaching the service → 400 `UNSUPPORTED_SCALE_UNIT`
    (`UnsupportedScaleUnitException`).
  - Cross-category conversion request → 400 `CROSS_CATEGORY_CONVERSION`
    (`CrossCategoryConversionException`).

## Environment variables

None.

## Contract

Core module `src/modules/cores/scale-unit/`:

- `constants/scale-unit-categories.ts` → enum `ScaleUnitCategories { WEIGHT = 'WEIGHT' }` (plural-noun
  enum per `generic.md`; `LENGTH` is the documented extension example, not shipped).
- `constants/weight-units.ts` → enum `WeightUnits { KILOGRAM = 'kg', POUND = 'lb' }` — the per-category
  unit enum; **values are the wire codes** (human-approved deviation from the `SNAKE_UPPER_CASE`
  enum-value rule, `architecture.md` §1, so enum/registry/DB/wire never drift). A new category would
  add its own `<Category>Units` enum alongside.
- `models/scale-unit.ts` → `ScaleUnit` (interface or class):
  `{ code: string; name: string; description: string; category: ScaleUnitCategories;
  factorToBase: number }`. `factorToBase` converts a value in this unit to the category **base**
  (base = kg for `WEIGHT`, so kg has `factorToBase: 1`, lb has `0.45359237`).
- `constants/scale-unit-definitions.ts` → `ScaleUnitDefinitions` — the registry: a `const` list of
  every `ScaleUnit`, queryable by code and by category. For this sprint:
  - `{ code: 'kg', name: 'Kilogram', description: 'Metric base unit of mass', category: WEIGHT,
    factorToBase: 1 }`
  - `{ code: 'lb', name: 'Pound', description: 'Imperial unit of mass', category: WEIGHT,
    factorToBase: 0.45359237 }`
  - Also declare, per category, its **base code** (kg for WEIGHT) so normalization targets are
    config-driven, not hardcoded.
  - **Extensibility:** adding `stone` = one `WeightUnits` member + one registry entry; adding a whole
    `LENGTH` category = a `ScaleUnitCategories` member + a `LengthUnits` enum + its registry entries +
    its base code — no business-code change.
- `services/scale-unit-conversion/scale-unit-conversion-service.interface.ts` →
  `IScaleUnitConversionService`:
  - `convertAsync(value: number, fromCode: string, toCode: string): Promise<number>` — category-aware
    core. Unknown `fromCode`/`toCode` → `UnsupportedScaleUnitException`; different categories →
    `CrossCategoryConversionException`; otherwise `value * fromFactorToBase / toFactorToBase`.
  - `toBaseAsync(value: number, code: string): Promise<number>` — normalize on write (weight → kg).
  - `fromBaseAsync(valueBase: number, code: string): Promise<number>` — display conversion on read,
    rounded to **2 dp**.
  - `isSupported(code: string): boolean`; `getCategory(code: string): ScaleUnitCategories`
    (unknown → `UnsupportedScaleUnitException`); `getCodesByCategory(category): string[]`.
- `services/scale-unit-conversion/scale-unit-conversion.service.ts`,
  `scale-unit-conversion-injection-tokens.ts`
  (`ScaleUnitConversionServiceInjectionTokens.SERVICE__SCALE_UNIT_CONVERSION`),
  `scale-unit-conversion.service.module.ts`.
- `exceptions/unsupported-scale-unit.exception.ts` → `UnsupportedScaleUnitException extends
  BusinessException` (`UNSUPPORTED_SCALE_UNIT`, 400), message naming the offending code.
- `exceptions/cross-category-conversion.exception.ts` → `CrossCategoryConversionException extends
  BusinessException` (`CROSS_CATEGORY_CONVERSION`, 400), message naming both codes/categories.
- `scale-unit.module.ts` (`ScaleUnitModule`): provides + exports the service module.
- Reusable `src/common/schemas/weight-unit.joi-schema.ts` →
  `weightUnitJoiSchema = Joi.string().valid(...getCodesByCategory(WEIGHT))` (codes sourced from the
  registry so the accepted set never drifts). Named for the weight category it validates; a future
  category gets its own schema.

> `architecture.md` §5 error-code catalogue is extended with `UNSUPPORTED_SCALE_UNIT` and
> `CROSS_CATEGORY_CONVERSION` (Task 1 declares the enum members; the exception classes are added
> here).

## Reuse note for downstream tasks

- F5: `toBaseAsync` normalizes each set's weight to kg before insert; `weightUnitJoiSchema` validates
  the per-set `unit`.
- F6/F7/F8: `fromBaseAsync` converts stored kg to the **required** output `unit` for display;
  `weightUnitJoiSchema` validates that query `unit`.

## Tests to define (in-memory not required — pure logic)

- `src/modules/cores/scale-unit/services/scale-unit-conversion/scale-unit-conversion.service.spec.ts`:
  - `describe('convertAsync')` — kg→kg (identity); kg→lb and lb→kg (exact factor); unknown code →
    `UnsupportedScaleUnitException` (assert exact type); cross-category (kg → a stub length code) →
    `CrossCategoryConversionException` (assert exact type). To exercise the cross-category branch
    without shipping a length unit, the test registers/uses a fixture unit in a second category (or
    the spec notes the branch is covered via a seam) — document the approach in the test.
  - `describe('toBaseAsync')` — kg passes through (factor 1); lb normalizes (× 0.45359237); unknown
    code throws.
  - `describe('fromBaseAsync')` — kg→kg; kg→lb; rounding to 2 dp; unknown code throws.
  - `describe('isSupported')` — true for kg/lb, false otherwise.
  - `describe('getCategory')` — returns `WEIGHT` for kg/lb; unknown → throws.
  - `describe('getCodesByCategory')` — returns `['kg','lb']` for `WEIGHT`.
- `src/common/schemas/weight-unit.joi-schema.spec.ts` — accepts kg/lb, rejects an unknown unit.

## Existing tests that must change

- **None.** → **ready**.

## Files to create/change

The `scale-unit/` core module tree (categories + per-category unit enum + `ScaleUnit` model +
definitions registry, the conversion service folder, both exceptions, the module), and the reusable
`weight-unit.joi-schema.ts`. Change: none in `app.module.ts` (the core module is imported by
consumers — Tasks 5–9).

## Done when

`pnpm nx test api` passes with full branch coverage of the conversion service (including the
cross-category and unsupported-code branches); `pnpm nx build api` succeeds; adding a hypothetical
unit or category demonstrably touches only the enum(s) + registry; conventions met.
