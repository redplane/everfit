import Joi from 'joi';
import { ScaleUnitCategories } from '../../modules/cores/scale-unit/constants/scale-unit-categories';
import { ScaleUnitDefinitions } from '../../modules/cores/scale-unit/constants/scale-unit-definitions';

/**
 * The accepted weight-category wire codes, sourced directly from the single `ScaleUnitDefinitions`
 * registry so the validated set never drifts from the registry. (A module-level `const` cannot call
 * the injected `IScaleUnitConversionService.getCodesByCategory`, so this filters the same registry
 * the service reads — identical result.)
 */
const weightUnitCodes: string[] = ScaleUnitDefinitions.filter(
  (definition) => definition.category === ScaleUnitCategories.WEIGHT,
).map((definition) => definition.code);

/**
 * Reusable Joi schema validating a weight-category unit code (`'kg'` / `'lb'`). Used by workout
 * logging (F5, the per-set `unit`) and every read that returns weights in a requested unit
 * (F6/F7/F8, the query `unit`). A future category gets its own schema.
 */
export const weightUnitJoiSchema = Joi.string().valid(...weightUnitCodes);
