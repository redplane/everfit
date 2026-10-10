import { ApiProperty } from '@nestjs/swagger';
import { WorkoutSetPayload } from './workout-set-payload.dto';

/**
 * Request shape for one exercise entry within a (single or bulk) workout log (F5). A single-exercise
 * log is simply a payload whose `entries` has one element.
 */
export class WorkoutEntryPayload {
  //#region Properties
  @ApiProperty({ description: 'The id of the exercise performed (UUID).', format: 'uuid' })
  public exerciseId: string;

  @ApiProperty({
    description: 'When the workout was performed (ISO 8601 date-time; stored as UTC).',
    example: '2026-10-10T08:30:00.000Z',
  })
  public performedAt: string;

  @ApiProperty({
    description: 'The sets performed for this exercise (at least one).',
    type: () => [WorkoutSetPayload],
  })
  public sets: WorkoutSetPayload[];
  //#endregion
}
