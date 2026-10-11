/**
 * The categories a scale unit can belong to. Conversion is only ever valid **within** one category
 * (converting across categories raises `CrossCategoryConversionException`). This sprint ships only
 * `WEIGHT`; `LENGTH` is the documented extension example — adding a whole new category is a
 * `ScaleUnitCategories` member + its own `<Category>Units` enum + registry entries + base code, with
 * no change to business code (F4 extensibility, architecture.md §6).
 */
export enum ScaleUnitCategories {
  WEIGHT = 'WEIGHT',
  // LENGTH = 'LENGTH', // extension example — not shipped this sprint.
}
