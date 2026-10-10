import { HttpStatus } from '@nestjs/common';
import { BusinessException } from '../../../../common/exceptions/business.exception';
import { BusinessExceptionCodes } from '../../../../common/constants/business-exception-codes';

/**
 * Thrown when a logged set would violate the uniqueness rule
 * `(user_id, exercise_id, performed_at, set_number)` — a true duplicate (same user, exercise,
 * instant, and ordinal). A legitimate repeated set (same reps/weight, different ordinal) is NOT a
 * duplicate and is accepted. Enforced by the DB unique constraint
 * (`uq_workout_sets_user_id_exercise_id_performed_at_set_number`, Postgres `23505`) translated at the
 * service boundary; surfaced by the global business-exception filter as HTTP 409 with the stable
 * `WORKOUT_ALREADY_EXISTS` code. Within a bulk request the whole batch rolls back (§8).
 */
export class WorkoutSetAlreadyExistsException extends BusinessException {
  //#region Constructor
  public constructor() {
    super(
      BusinessExceptionCodes.WORKOUT_ALREADY_EXISTS,
      'A duplicate workout set was submitted (same user, exercise, instant, and set number). ' +
        'The request was rejected and nothing was written.',
      HttpStatus.CONFLICT,
    );
  }
  //#endregion
}
