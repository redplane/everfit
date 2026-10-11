import { ApiProperty } from '@nestjs/swagger';

/**
 * Request shape for one set within a logged exercise entry (F5). `setNumber` is NOT accepted from the
 * client — it is assigned server-side by array order so two identical sets are distinct repeats.
 */
export class WorkoutSetPayload {
  //#region Properties
  @ApiProperty({ description: 'The number of repetitions performed (positive integer).', example: 8 })
  public reps: number;

  @ApiProperty({
    description: 'The weight lifted, in the given unit (positive).',
    example: 100,
  })
  public weight: number;

  @ApiProperty({ description: "The weight unit code ('kg' or 'lb').", example: 'kg' })
  public unit: string;
  //#endregion
}
