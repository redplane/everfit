import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Query parameters for `GET /api/users` — offset pagination for read-only user discovery (F2).
 */
export class GetUsersQueryDto {
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
