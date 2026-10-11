import { ApiProperty } from '@nestjs/swagger';
import { WorkoutEntryPayload } from './workout-entry-payload.dto';

/**
 * Request body for `POST /api/workout` (F5) — bulk-capable: one `userId` and one or more exercise
 * `entries`, each with its sets. The whole request is logged in one all-or-nothing transaction.
 */
export class CreateWorkoutPayloadDto {
  //#region Properties
  @ApiProperty({ description: 'The id of the user the workout is logged for (UUID).', format: 'uuid' })
  public userId: string;

  @ApiProperty({
    description: 'The exercise entries to log (at least one).',
    type: () => [WorkoutEntryPayload],
  })
  public entries: WorkoutEntryPayload[];
  //#endregion
}
