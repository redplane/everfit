import { ApiProperty } from '@nestjs/swagger';
import { WorkoutSetEntity } from '../../../cores/workout/entities/workout-set.entity';

/**
 * Response shape for one persisted set (F5). Echoes the server-assigned `setNumber`, what the coach
 * entered (`reps`, `weight`, `unit`), and the normalized `weightKg` that was stored.
 */
export class LoggedWorkoutSetDto {
  //#region Properties
  @ApiProperty({ description: 'The set id (UUID).', format: 'uuid' })
  public id: string;

  @ApiProperty({ description: 'The server-assigned 1-based set ordinal within the entry.' })
  public setNumber: number;

  @ApiProperty({ description: 'Repetitions performed.' })
  public reps: number;

  @ApiProperty({ description: 'Weight as entered, in the original unit.' })
  public weight: number;

  @ApiProperty({ description: "The original weight unit code ('kg' / 'lb')." })
  public unit: string;

  @ApiProperty({ description: 'The normalized weight in kilograms (storage canonical).' })
  public weightKg: number;
  //#endregion

  //#region Constructor
  public constructor(
    id: string,
    setNumber: number,
    reps: number,
    weight: number,
    unit: string,
    weightKg: number,
  ) {
    this.id = id;
    this.setNumber = setNumber;
    this.reps = reps;
    this.weight = weight;
    this.unit = unit;
    this.weightKg = weightKg;
  }
  //#endregion

  //#region Methods
  public static fromEntity(entity: WorkoutSetEntity): LoggedWorkoutSetDto {
    return new LoggedWorkoutSetDto(
      entity.id,
      entity.setNumber,
      entity.reps,
      entity.weight,
      entity.unit,
      entity.weightKg,
    );
  }
  //#endregion
}
