import { HttpStatus } from '@nestjs/common';
import { BusinessException } from '../../../../common/exceptions/business.exception';
import { BusinessExceptionCodes } from '../../../../common/constants/business-exception-codes';

/**
 * Thrown when a muscle group is looked up by id and no such record exists. Surfaced by the global
 * business-exception filter as HTTP 404 with the stable `MUSCLE_GROUP_NOT_FOUND` code.
 */
export class MuscleGroupByIdNotFoundException extends BusinessException {
  //#region Constructor
  public constructor(id: string) {
    super(
      BusinessExceptionCodes.MUSCLE_GROUP_NOT_FOUND,
      `Muscle group with id "${id}" was not found.`,
      HttpStatus.NOT_FOUND,
    );
  }
  //#endregion
}
