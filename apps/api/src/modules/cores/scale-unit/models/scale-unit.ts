import { ScaleUnitCategories } from '../constants/scale-unit-categories';

/**
 * A single unit in the in-code scale-unit registry. Pure shape (no behavior) → an `interface`
 * (`generic.md` §2).
 *
 * - `code` — the stable wire code (e.g. `'kg'` / `'lb'`); the value stored on `workout_sets.unit`.
 * - `name` / `description` — human-facing metadata (e.g. for discovery/docs).
 * - `category` — the category this unit belongs to; conversion is only valid within one category.
 * - `factorToBase` — multiplier that converts a value in this unit to the category's **base** unit
 *   (base = kg for `WEIGHT`, so kg has `factorToBase: 1`, lb has `0.45359237`).
 */
export interface ScaleUnit {
  //#region Properties
  code: string;
  name: string;
  description: string;
  category: ScaleUnitCategories;
  factorToBase: number;
  //#endregion
}
