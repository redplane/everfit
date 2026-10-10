import { HttpStatus } from '@nestjs/common';
import { BusinessException } from '../../../../common/exceptions/business.exception';
import { BusinessExceptionCodes } from '../../../../common/constants/business-exception-codes';

/**
 * Thrown when an exercise is looked up by id and no such record exists. Surfaced by the global
 * business-exception filter as HTTP 404 with the stable `EXERCISE_NOT_FOUND` code. Used by logging
 * (F5) to reject a workout against a non-existent exercise.
 */
export class ExerciseByIdNotFoundException extends BusinessException {
  //#region Constructor
  public constructor(id: string) {
    super(
      BusinessExceptionCodes.EXERCISE_NOT_FOUND,
      `Exercise with id "${id}" was not found.`,
      HttpStatus.NOT_FOUND,
    );
  }
  //#endregion
}
