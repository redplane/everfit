import { ScaleUnitConversionService } from './scale-unit-conversion.service';
import { ScaleUnit } from '../../models/scale-unit';
import { ScaleUnitCategories } from '../../constants/scale-unit-categories';
import { WeightUnits } from '../../constants/weight-units';
import { UnsupportedScaleUnitException } from '../../exceptions/unsupported-scale-unit.exception';
import { CrossCategoryConversionException } from '../../exceptions/cross-category-conversion.exception';

/**
 * Pure logic — no in-memory DB needed (no persistence). The service under test uses the production
 * registry by default. The cross-category branch is driven via the approved optional-registry seam:
 * a fixture registry that adds a second, LENGTH-category unit (`'m'`) alongside the real weight units,
 * so `CrossCategoryConversionException` can be exercised without shipping a length unit and without
 * mutating module globals.
 */

// The exact lb→kg factor, asserted throughout so display vs. compute precision stays explicit.
const LB_FACTOR = 0.45359237;

// Fixture registry: real weight units plus a LENGTH-category unit used only to drive the
// cross-category branch. `ScaleUnitCategories` ships only WEIGHT this sprint, so the fixture uses a
// cast for the unshipped LENGTH category.
const LENGTH_CATEGORY = 'LENGTH' as unknown as ScaleUnitCategories;
const fixtureDefinitions: readonly ScaleUnit[] = [
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
    factorToBase: LB_FACTOR,
  },
  {
    code: 'm',
    name: 'Metre',
    description: 'Metric base unit of length',
    category: LENGTH_CATEGORY,
    factorToBase: 1,
  },
];
// String-literal keys (their runtime values match the enum/category values) so the two computed
// keys are not both inferred as `ScaleUnitCategories` → avoids a TS duplicate-key error.
const fixtureBaseCodes: Record<string, string> = {
  WEIGHT: WeightUnits.KILOGRAM,
  LENGTH: 'm',
};

describe('ScaleUnitConversionService', () => {
  let service: ScaleUnitConversionService;

  beforeEach(() => {
    // Default (production) registry.
    service = new ScaleUnitConversionService();
  });

  //#region convertAsync
  describe('convertAsync', () => {
    it('returns the same value for an identity conversion (kg→kg)', async () => {
      await expect(service.convertAsync(42.5, WeightUnits.KILOGRAM, WeightUnits.KILOGRAM)).resolves.toBe(
        42.5,
      );
    });

    it('converts kg→lb using the exact factor (no rounding — full precision)', async () => {
      const result = await service.convertAsync(1, WeightUnits.KILOGRAM, WeightUnits.POUND);

      // 1 / 0.45359237 ≈ 2.2046226218..., kept at full precision (not rounded to 2 dp).
      expect(result).toBeCloseTo(1 / LB_FACTOR, 10);
      expect(result).not.toBe(2.2); // proves convertAsync does not apply 2-dp display rounding
    });

    it('converts lb→kg using the exact factor', async () => {
      await expect(service.convertAsync(1, WeightUnits.POUND, WeightUnits.KILOGRAM)).resolves.toBeCloseTo(
        LB_FACTOR,
        10,
      );
    });

    it('round-trips a whole-number lb value: 0.45359237 kg → 1 lb', async () => {
      await expect(service.convertAsync(LB_FACTOR, WeightUnits.KILOGRAM, WeightUnits.POUND)).resolves.toBeCloseTo(
        1,
        10,
      );
    });

    it('throws UnsupportedScaleUnitException for an unknown fromCode', async () => {
      await expect(service.convertAsync(1, 'stone', WeightUnits.KILOGRAM)).rejects.toBeInstanceOf(
        UnsupportedScaleUnitException,
      );
    });

    it('throws UnsupportedScaleUnitException for an unknown toCode (valid fromCode)', async () => {
      await expect(service.convertAsync(1, WeightUnits.KILOGRAM, 'stone')).rejects.toBeInstanceOf(
        UnsupportedScaleUnitException,
      );
    });

    it('throws CrossCategoryConversionException when codes are in different categories', async () => {
      const seamService = new ScaleUnitConversionService(fixtureDefinitions, fixtureBaseCodes);

      await expect(seamService.convertAsync(1, WeightUnits.KILOGRAM, 'm')).rejects.toBeInstanceOf(
        CrossCategoryConversionException,
      );
    });
  });
  //#endregion

  //#region toBaseAsync
  describe('toBaseAsync', () => {
    it('passes kg through unchanged (factor 1)', async () => {
      await expect(service.toBaseAsync(80, WeightUnits.KILOGRAM)).resolves.toBe(80);
    });

    it('normalizes lb to kg (× 0.45359237)', async () => {
      await expect(service.toBaseAsync(1, WeightUnits.POUND)).resolves.toBeCloseTo(LB_FACTOR, 10);
    });

    it('throws UnsupportedScaleUnitException for an unknown code', async () => {
      await expect(service.toBaseAsync(1, 'stone')).rejects.toBeInstanceOf(
        UnsupportedScaleUnitException,
      );
    });
  });
  //#endregion

  //#region fromBaseAsync
  describe('fromBaseAsync', () => {
    it('passes a kg base value through, rounded to 2 dp (÷ 1)', async () => {
      await expect(service.fromBaseAsync(80.004, WeightUnits.KILOGRAM)).resolves.toBe(80);
    });

    it('converts a kg base value to lb and rounds to 2 dp (display precision)', async () => {
      // 1 kg → 2.2046226... lb, rounded to 2 dp = 2.2
      await expect(service.fromBaseAsync(1, WeightUnits.POUND)).resolves.toBe(2.2);
    });

    it('rounds up at the third decimal place (Math.round(n*100)/100)', async () => {
      // 1.236 → 1.24 (third decimal 6 rounds the 2-dp value up)
      await expect(service.fromBaseAsync(1.236, WeightUnits.KILOGRAM)).resolves.toBe(1.24);
    });

    it('throws UnsupportedScaleUnitException for an unknown code', async () => {
      await expect(service.fromBaseAsync(1, 'stone')).rejects.toBeInstanceOf(
        UnsupportedScaleUnitException,
      );
    });
  });
  //#endregion

  //#region isSupported
  describe('isSupported', () => {
    it('returns true for a registered code (kg, lb)', () => {
      expect(service.isSupported(WeightUnits.KILOGRAM)).toBe(true);
      expect(service.isSupported(WeightUnits.POUND)).toBe(true);
    });

    it('returns false for an unregistered code', () => {
      expect(service.isSupported('stone')).toBe(false);
    });
  });
  //#endregion

  //#region getCategory
  describe('getCategory', () => {
    it('returns WEIGHT for kg and lb', () => {
      expect(service.getCategory(WeightUnits.KILOGRAM)).toBe(ScaleUnitCategories.WEIGHT);
      expect(service.getCategory(WeightUnits.POUND)).toBe(ScaleUnitCategories.WEIGHT);
    });

    it('throws UnsupportedScaleUnitException for an unknown code', () => {
      expect(() => service.getCategory('stone')).toThrow(UnsupportedScaleUnitException);
    });
  });
  //#endregion

  //#region getCodesByCategory
  describe('getCodesByCategory', () => {
    it('returns the weight-category codes (kg, lb)', () => {
      expect(service.getCodesByCategory(ScaleUnitCategories.WEIGHT)).toEqual([
        WeightUnits.KILOGRAM,
        WeightUnits.POUND,
      ]);
    });

    it('returns an empty array for a category with no registered units', () => {
      // The production registry has no LENGTH units → empty branch.
      expect(service.getCodesByCategory(LENGTH_CATEGORY)).toEqual([]);
    });
  });
  //#endregion
});
