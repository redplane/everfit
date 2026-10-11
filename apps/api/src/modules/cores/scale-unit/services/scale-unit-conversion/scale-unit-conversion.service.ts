import { Injectable } from '@nestjs/common';
import { IScaleUnitConversionService } from './scale-unit-conversion-service.interface';
import { ScaleUnit } from '../../models/scale-unit';
import { ScaleUnitCategories } from '../../constants/scale-unit-categories';
import {
  ScaleUnitCategoryBaseCodes,
  ScaleUnitDefinitions,
} from '../../constants/scale-unit-definitions';
import { UnsupportedScaleUnitException } from '../../exceptions/unsupported-scale-unit.exception';
import { CrossCategoryConversionException } from '../../exceptions/cross-category-conversion.exception';

/**
 * Category-aware scale-unit conversion over the in-code registry (F4, architecture.md §6). Pure logic
 * — no DB, no clock, no scattered `if`. The registry (unit definitions + per-category base codes) is
 * an **optional** constructor dependency defaulting to the production constants; tests inject a
 * fixture registry (e.g. a LENGTH unit) to drive the cross-category branch deterministically without
 * shipping a second category or mutating module globals.
 */
@Injectable()
export class ScaleUnitConversionService implements IScaleUnitConversionService {
  //#region Properties
  private readonly __definitionsByCode: ReadonlyMap<string, ScaleUnit>;
  private readonly __baseCodesByCategory: Readonly<Record<string, string>>;
  //#endregion

  //#region Constructor
  public constructor(
    definitions: readonly ScaleUnit[] = ScaleUnitDefinitions,
    baseCodesByCategory: Readonly<Record<string, string>> = ScaleUnitCategoryBaseCodes,
  ) {
    this.__definitionsByCode = new Map(
      definitions.map((definition) => [definition.code, definition]),
    );
    this.__baseCodesByCategory = baseCodesByCategory;
  }
  //#endregion

  //#region Methods
  public async convertAsync(value: number, fromCode: string, toCode: string): Promise<number> {
    const from = this.__getDefinitionOrThrow(fromCode);
    const to = this.__getDefinitionOrThrow(toCode);

    if (from.category !== to.category) {
      throw new CrossCategoryConversionException(
        from.code,
        from.category,
        to.code,
        to.category,
      );
    }

    return (value * from.factorToBase) / to.factorToBase;
  }

  public async toBaseAsync(value: number, code: string): Promise<number> {
    const definition = this.__getDefinitionOrThrow(code);
    // Normalize towards the category's config-declared base code (same category → never
    // cross-category; the base unit's factorToBase is 1, so this equals value * factorToBase).
    const baseCode = this.__baseCodesByCategory[definition.category];

    return this.convertAsync(value, code, baseCode);
  }

  public async fromBaseAsync(valueBase: number, code: string): Promise<number> {
    const definition = this.__getDefinitionOrThrow(code);
    const converted = valueBase / definition.factorToBase;

    return Math.round(converted * 100) / 100;
  }

  public isSupported(code: string): boolean {
    return this.__definitionsByCode.has(code);
  }

  public getCategory(code: string): ScaleUnitCategories {
    return this.__getDefinitionOrThrow(code).category;
  }

  public getCodesByCategory(category: ScaleUnitCategories): string[] {
    const codes: string[] = [];

    for (const definition of this.__definitionsByCode.values()) {
      if (definition.category === category) {
        codes.push(definition.code);
      }
    }

    return codes;
  }
  //#endregion

  ///#region Internal methods
  /**
   * Returns the registry definition for `code`, or throws `UnsupportedScaleUnitException`. The single
   * guard reused by every conversion/lookup method so the unsupported-code behavior is consistent.
   */
  private __getDefinitionOrThrow(code: string): ScaleUnit {
    const definition = this.__definitionsByCode.get(code);

    if (definition === undefined) {
      throw new UnsupportedScaleUnitException(code);
    }

    return definition;
  }
  //#endregion
}
