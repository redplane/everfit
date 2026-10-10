/**
 * The units of the WEIGHT category.
 *
 * NOTE — deliberate, human-approved deviation (architecture.md §1): the enum **values are the wire
 * codes** (`'kg'` / `'lb'`, lowercase), not the `SNAKE_UPPER_CASE` values `generic.md` §2 mandates for
 * enum values. This is intentional so that the enum, the `ScaleUnitDefinitions` registry, the DB
 * `workout_sets.unit` column, and the wire all agree on a single value and can never drift. A new
 * weight unit (e.g. stone) is one member here + one registry entry; a new category is its own
 * `<Category>Units` enum alongside this one.
 */
export enum WeightUnits {
  KILOGRAM = 'kg',
  POUND = 'lb',
}
