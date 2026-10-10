import { HttpStatus } from '@nestjs/common';
import { BusinessException } from '../../../../common/exceptions/business.exception';
import { BusinessExceptionCodes } from '../../../../common/constants/business-exception-codes';

/**
 * Thrown when the same `(exercise, muscle group)` mapping is added again. The pair is unique, so a
 * duplicate is rejected rather than silently duplicated (F3). Enforced by the service and the DB
 * unique constraint (`uq_exercise_muscle_groups_exercise_id_muscle_group_id`, Postgres `23505`);
 * surfaced by the global business-exception filter as HTTP 409 with the stable
 * `EXERCISE_MUSCLE_GROUP_ALREADY_EXISTS` code. Exercised by the seed path (Task 9), not an HTTP
 * route this sprint.
 */
export class ExerciseMuscleGroupAlreadyExistsException extends BusinessException {
  //#region Constructor
  public constructor(exerciseId: string, muscleGroupId: string) {
    super(
      BusinessExceptionCodes.EXERCISE_MUSCLE_GROUP_ALREADY_EXISTS,
      `Exercise "${exerciseId}" is already mapped to muscle group "${muscleGroupId}".`,
      HttpStatus.CONFLICT,
    );
  }
  //#endregion
}
