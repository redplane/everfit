import { ApiProperty } from '@nestjs/swagger';
import { MuscleGroupEntity } from '../../../cores/exercise/entities/muscle-group.entity';

/**
 * Response shape for a muscle group. Minimal master-data projection (F3) — id and display name.
 * Reused inside `ExerciseDto.muscleGroups` to report an exercise's mapped muscle groups.
 */
export class MuscleGroupDto {
  //#region Properties
  @ApiProperty({ description: 'The muscle-group id (UUID).', format: 'uuid' })
  public id: string;

  @ApiProperty({ description: 'The muscle-group display name.' })
  public name: string;
  //#endregion

  //#region Constructor
  public constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }
  //#endregion

  //#region Methods
  public static fromEntity(entity: MuscleGroupEntity): MuscleGroupDto {
    return new MuscleGroupDto(entity.id, entity.name);
  }
  //#endregion
}
