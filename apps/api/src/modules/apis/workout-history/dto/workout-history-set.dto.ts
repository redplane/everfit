import { ApiProperty } from '@nestjs/swagger';

/**
 * Response shape for one set in a workout-history item (F6). `weight` is the stored `weight_kg`
 * converted to the requested output unit (display-only, 2 dp); `originalWeight` / `originalUnit`
 * retain exactly what the coach entered, so no information is lost on the round trip.
 */
export class WorkoutHistorySetDto {
  //#region Properties
  @ApiProperty({ description: 'The 1-based set ordinal within the entry.' })
  public setNumber: number;

  @ApiProperty({ description: 'Repetitions performed.' })
  public reps: number;

  @ApiProperty({ description: 'Weight converted to the requested output unit (2 dp).' })
  public weight: number;

  @ApiProperty({ description: 'The weight exactly as entered, in the original unit.' })
  public originalWeight: number;

  @ApiProperty({ description: "The original weight unit code as entered ('kg' / 'lb')." })
  public originalUnit: string;
  //#endregion

  //#region Constructor
  public constructor(
    setNumber: number,
    reps: number,
    weight: number,
    originalWeight: number,
    originalUnit: string,
  ) {
    this.setNumber = setNumber;
    this.reps = reps;
    this.weight = weight;
    this.originalWeight = originalWeight;
    this.originalUnit = originalUnit;
  }
  //#endregion
}
