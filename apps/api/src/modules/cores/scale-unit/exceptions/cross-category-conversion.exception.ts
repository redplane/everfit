import { HttpStatus } from '@nestjs/common';
import { BusinessException } from '../../../../common/exceptions/business.exception';
import { BusinessExceptionCodes } from '../../../../common/constants/business-exception-codes';
import { ScaleUnitCategories } from '../constants/scale-unit-categories';

/**
 * Thrown when a conversion is requested between two units in **different** categories (e.g. weight ↔
 * length). Cross-category conversion is never silently coerced. Surfaced by the global
 * business-exception filter as HTTP 400 with the stable `CROSS_CATEGORY_CONVERSION` code.
 */
export class CrossCategoryConversionException extends BusinessException {
  //#region Constructor
  public constructor(
    fromCode: string,
    fromCategory: ScaleUnitCategories,
    toCode: string,
    toCategory: ScaleUnitCategories,
  ) {
    super(
      BusinessExceptionCodes.CROSS_CATEGORY_CONVERSION,
      `Cannot convert between "${fromCode}" (${fromCategory}) and "${toCode}" (${toCategory}): ` +
        `cross-category conversion is not allowed.`,
      HttpStatus.BAD_REQUEST,
    );
  }
  //#endregion
}
