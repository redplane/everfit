import { HttpStatus } from '@nestjs/common';
import { BusinessException } from '../../../../common/exceptions/business.exception';
import { BusinessExceptionCodes } from '../../../../common/constants/business-exception-codes';

/**
 * Thrown when a user is looked up by id and no such record exists. Surfaced by the global
 * business-exception filter as HTTP 404 with the stable `USER_NOT_FOUND` code — this is the
 * "unknown user" case, distinct from a known user who simply has no data (empty result).
 */
export class UserByIdNotFoundException extends BusinessException {
  //#region Constructor
  public constructor(id: string) {
    super(
      BusinessExceptionCodes.USER_NOT_FOUND,
      `User with id "${id}" was not found.`,
      HttpStatus.NOT_FOUND,
    );
  }
  //#endregion
}
