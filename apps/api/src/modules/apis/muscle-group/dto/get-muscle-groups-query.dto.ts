import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Query parameters for `GET /api/muscle-groups` — offset pagination for read-only muscle-group
 * discovery (F3).
 */
export class GetMuscleGroupsQueryDto {
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
  //#endregion
}
