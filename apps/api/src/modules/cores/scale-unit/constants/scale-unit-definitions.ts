import { ScaleUnit } from '../models/scale-unit';
import { ScaleUnitCategories } from './scale-unit-categories';
import { WeightUnits } from './weight-units';

/**
 * The single in-code source of truth for every supported scale unit (F4). The conversion service
 * queries this by code and by category; the reusable `weightUnitJoiSchema` derives its accepted
 * values from it so the wire set never drifts from the registry.
 *
 * Extensibility: adding a unit (e.g. stone) = one `WeightUnits` member + one entry here; adding a
 * whole category = a `ScaleUnitCategories` member + a `<Category>Units` enum + its entries here + its
 * base code in `ScaleUnitCategoryBaseCodes` — no business-code change.
 */
export const ScaleUnitDefinitions: readonly ScaleUnit[] = [
  {
    code: WeightUnits.KILOGRAM,
    name: 'Kilogram',
    description: 'Metric base unit of mass',
    category: ScaleUnitCategories.WEIGHT,
    factorToBase: 1,
  },
  {
    code: WeightUnits.POUND,
    name: 'Pound',
    description: 'Imperial unit of mass',
    category: ScaleUnitCategories.WEIGHT,
    factorToBase: 0.45359237,
  },
];

/**
 * The base unit code per category — the normalization target for `toBaseAsync` (storage canonical).
 * Config-driven rather than hardcoded so a new category declares its base here. The base unit's
 * `factorToBase` in `ScaleUnitDefinitions` must be `1`.
 */
export const ScaleUnitCategoryBaseCodes: Record<ScaleUnitCategories, string> = {
  [ScaleUnitCategories.WEIGHT]: WeightUnits.KILOGRAM,
};
