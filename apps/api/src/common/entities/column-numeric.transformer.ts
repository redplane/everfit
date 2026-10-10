import { ValueTransformer } from 'typeorm';

/**
 * TypeORM column transformer for `numeric`/`decimal` columns. Postgres `numeric` is returned by the
 * driver as a **string** (to preserve arbitrary precision); this transformer parses it back to a JS
 * `number` on read so entities, response DTOs, and the F7/F8 aggregation math work with numbers
 * directly. On write the value is passed through unchanged — TypeORM/pg serialises the number to the
 * column's precision/scale.
 *
 * Trade-off: values beyond IEEE-754 double precision would lose precision; the workout weights
 * here (`numeric(7,3)` / `numeric(9,4)`) are well within that range, so it is safe.
 */
export class ColumnNumericTransformer implements ValueTransformer {
  //#region Methods
  public to(value: number | null | undefined): number | null | undefined {
    return value;
  }

  public from(value: string | null | undefined): number | null | undefined {
    if (value === null || value === undefined) {
      return value as null | undefined;
    }

    return parseFloat(value);
  }
  //#endregion
}
