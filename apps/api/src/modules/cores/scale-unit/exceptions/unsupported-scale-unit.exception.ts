import { HttpStatus } from '@nestjs/common';
import { BusinessException } from '../../../../common/exceptions/business.exception';
import { BusinessExceptionCodes } from '../../../../common/constants/business-exception-codes';

/**
 * Thrown when a scale-unit code that is not in the registry reaches the conversion service (past the
 * Joi request-boundary validation). Surfaced by the global business-exception filter as HTTP 400 with
 * the stable `UNSUPPORTED_SCALE_UNIT` code.
 */
export class UnsupportedScaleUnitException extends BusinessException {
  //#region Constructor
  public constructor(code: string) {
    super(
      BusinessExceptionCodes.UNSUPPORTED_SCALE_UNIT,
      `Scale unit "${code}" is not supported.`,
      HttpStatus.BAD_REQUEST,
    );
  }
  //#endregion
}
