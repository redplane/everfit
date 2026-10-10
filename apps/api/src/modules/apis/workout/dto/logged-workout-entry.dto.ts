import { ApiProperty } from '@nestjs/swagger';
import { LoggedWorkoutSetDto } from './logged-workout-set.dto';
import { WorkoutEntryEntity } from '../../../cores/workout/entities/workout-entry.entity';

/**
 * Response shape for one persisted exercise entry (F5): the parent id, exercise, instant, and its
 * row-per-set children.
 */
export class LoggedWorkoutEntryDto {
  //#region Properties
  @ApiProperty({ description: 'The workout entry id (UUID).', format: 'uuid' })
  public id: string;

  @ApiProperty({ description: 'The exercise id (UUID).', format: 'uuid' })
  public exerciseId: string;

  @ApiProperty({ description: 'When the workout was performed (UTC ISO 8601).' })
  public performedAt: Date;

  @ApiProperty({ description: 'The persisted sets.', type: () => [LoggedWorkoutSetDto] })
  public sets: LoggedWorkoutSetDto[];
  //#endregion

  //#region Constructor
  public constructor(
    id: string,
    exerciseId: string,
    performedAt: Date,
    sets: LoggedWorkoutSetDto[],
  ) {
    this.id = id;
    this.exerciseId = exerciseId;
    this.performedAt = performedAt;
    this.sets = sets;
  }
  //#endregion

  //#region Methods
  public static fromEntity(entity: WorkoutEntryEntity): LoggedWorkoutEntryDto {
    const sets = (entity.sets ?? []).map(LoggedWorkoutSetDto.fromEntity);

    return new LoggedWorkoutEntryDto(entity.id, entity.exerciseId, entity.performedAt, sets);
  }
  //#endregion
}
