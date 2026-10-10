import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Query parameters for `GET /api/exercises` — offset pagination plus optional filters for read-only
 * exercise discovery (F3).
 */
export class GetExercisesQueryDto {
  //#region Properties
  @ApiPropertyOptional({
    description: 'Page size (1..100).',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  public limit!: number;

  @ApiPropertyOptional({
    description: 'Number of records to skip.',
    minimum: 0,
    default: 0,
  })
  public offset!: number;

  @ApiPropertyOptional({
    description: 'Optional partial (case-insensitive) exercise-name filter.',
    maxLength: 200,
  })
  public name?: string;

  @ApiPropertyOptional({
    description: 'Optional muscle-group id (UUID) filter — only exercises mapped to it are returned.',
    format: 'uuid',
  })
  public muscleGroupId?: string;
  //#endregion
}
