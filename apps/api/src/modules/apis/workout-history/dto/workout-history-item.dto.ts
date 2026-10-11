import { ApiProperty } from '@nestjs/swagger';
import { WorkoutHistorySetDto } from './workout-history-set.dto';

/**
 * Response shape for one workout-history entry (F6): the parent id, its exercise (id + resolved
 * name), the UTC instant, the requested output `unit`, and the entry's sets (weights converted to
 * that unit, originals retained).
 */
export class WorkoutHistoryItemDto {
  //#region Properties
  @ApiProperty({ description: 'The workout entry id (UUID).', format: 'uuid' })
  public entryId: string;

  @ApiProperty({ description: 'The exercise id (UUID).', format: 'uuid' })
  public exerciseId: string;

  @ApiProperty({ description: 'The exercise name.' })
  public exerciseName: string;

  @ApiProperty({ description: 'When the workout was performed (UTC ISO 8601).' })
  public performedAt: Date;

  @ApiProperty({ description: "The output unit the weights are expressed in ('kg' / 'lb')." })
  public unit: string;

  @ApiProperty({ description: 'The entry sets.', type: () => [WorkoutHistorySetDto] })
  public sets: WorkoutHistorySetDto[];
  //#endregion

  //#region Constructor
  public constructor(
    entryId: string,
    exerciseId: string,
    exerciseName: string,
    performedAt: Date,
    unit: string,
    sets: WorkoutHistorySetDto[],
  ) {
    this.entryId = entryId;
    this.exerciseId = exerciseId;
    this.exerciseName = exerciseName;
    this.performedAt = performedAt;
    this.unit = unit;
    this.sets = sets;
  }
  //#endregion
}
