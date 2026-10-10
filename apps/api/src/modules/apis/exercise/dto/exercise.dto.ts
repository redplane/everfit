import { ApiProperty } from '@nestjs/swagger';
import { ExerciseEntity } from '../../../cores/exercise/entities/exercise.entity';
import { MuscleGroupDto } from '../../muscle-group/dto/muscle-group.dto';

/**
 * Response shape for an exercise (F3). Includes the exercise's mapped muscle groups so a caller can
 * pick a valid exercise to log or filter history by. `muscleGroups` is derived from the eager-loaded
 * M:N mapping; it is an empty array when the exercise has no mapping.
 */
export class ExerciseDto {
  //#region Properties
  @ApiProperty({ description: 'The exercise id (UUID).', format: 'uuid' })
  public id: string;

  @ApiProperty({ description: 'The exercise display name.' })
  public name: string;

  @ApiProperty({
    description: 'The muscle groups this exercise is mapped to.',
    type: () => [MuscleGroupDto],
  })
  public muscleGroups: MuscleGroupDto[];
  //#endregion

  //#region Constructor
  public constructor(id: string, name: string, muscleGroups: MuscleGroupDto[]) {
    this.id = id;
    this.name = name;
    this.muscleGroups = muscleGroups;
  }
  //#endregion

  //#region Methods
  public static fromEntity(entity: ExerciseEntity): ExerciseDto {
    const muscleGroups = (entity.exerciseMuscleGroups ?? [])
      .map((mapping) => mapping.muscleGroup)
      .filter((muscleGroup): muscleGroup is NonNullable<typeof muscleGroup> => muscleGroup != null)
      .map(MuscleGroupDto.fromEntity);

    return new ExerciseDto(entity.id, entity.name, muscleGroups);
  }
  //#endregion
}
