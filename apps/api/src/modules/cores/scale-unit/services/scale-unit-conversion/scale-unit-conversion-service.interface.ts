import { ScaleUnitCategories } from '../../constants/scale-unit-categories';

/**
 * Contract for category-aware scale-unit conversion (F4). Consumed via the
 * `SERVICE__SCALE_UNIT_CONVERSION` token by logging (F5, normalize on write) and every read that
 * returns weights in a requested unit (F6/F7/F8, convert on read). The registry is the single source
 * of truth; conversion is only ever valid within one category.
 */
export interface IScaleUnitConversionService {
  //#region Methods
  /**
   * Converts `value` from `fromCode` to `toCode`. Unknown `fromCode`/`toCode` →
   * `UnsupportedScaleUnitException`; codes in different categories → `CrossCategoryConversionException`;
   * otherwise `value * fromFactorToBase / toFactorToBase` (no rounding — full precision).
   */
  convertAsync(value: number, fromCode: string, toCode: string): Promise<number>;

  /**
   * Normalizes `value` (in `code`) to its category's base unit for storage (weight → kg). Unknown
   * `code` → `UnsupportedScaleUnitException`.
   */
  toBaseAsync(value: number, code: string): Promise<number>;

  /**
   * Converts a stored base-unit value to `code` for display, rounded to **2 dp**. Unknown `code` →
   * `UnsupportedScaleUnitException`.
   */
  fromBaseAsync(valueBase: number, code: string): Promise<number>;

  /**
   * Returns whether `code` is a registered scale unit. Does not throw for an unknown code.
   */
  isSupported(code: string): boolean;

  /**
   * Returns the category of `code`. Unknown `code` → `UnsupportedScaleUnitException`.
   */
  getCategory(code: string): ScaleUnitCategories;

  /**
   * Returns the wire codes registered for `category` (e.g. `['kg', 'lb']` for `WEIGHT`). Drives the
   * reusable `weightUnitJoiSchema`.
   */
  getCodesByCategory(category: ScaleUnitCategories): string[];
  //#endregion
}
