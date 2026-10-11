import { ApiProperty } from '@nestjs/swagger';
import { LoggedWorkoutEntryDto } from './logged-workout-entry.dto';
import { WorkoutEntryEntity } from '../../../cores/workout/entities/workout-entry.entity';

/**
 * Response body for `POST /api/workout` (F5) — the persisted entries (single or bulk), each with its
 * sets.
 */
export class LogWorkoutResultDto {
  //#region Properties
  @ApiProperty({ description: 'The persisted workout entries.', type: () => [LoggedWorkoutEntryDto] })
  public entries: LoggedWorkoutEntryDto[];
  //#endregion

  //#region Constructor
  public constructor(entries: LoggedWorkoutEntryDto[]) {
    this.entries = entries;
  }
  //#endregion

  //#region Methods
  public static fromEntities(entities: WorkoutEntryEntity[]): LogWorkoutResultDto {
    return new LogWorkoutResultDto(entities.map(LoggedWorkoutEntryDto.fromEntity));
  }
  //#endregion
}
