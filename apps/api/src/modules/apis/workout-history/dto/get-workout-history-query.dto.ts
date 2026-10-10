import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Query parameters for `GET /api/workout-history` (F6) — keyset pagination, the required output
 * `unit`, and the optional exercise-name / muscle-group / date-range filters.
 */
export class GetWorkoutHistoryQueryDto {
  //#region Properties
  @ApiProperty({ description: 'The user whose history is requested (UUID).', format: 'uuid' })
  public userId!: string;

  @ApiProperty({
    description: "Required output weight unit code ('kg' / 'lb'); weights are converted to it.",
  })
  public unit!: string;

  @ApiPropertyOptional({
    description: 'Optional partial (case-insensitive) exercise-name filter.',
    maxLength: 200,
  })
  public exerciseName?: string;

  @ApiPropertyOptional({
    description: 'Optional muscle-group id (UUID) — only entries whose exercise maps to it.',
    format: 'uuid',
  })
  public muscleGroupId?: string;

  @ApiPropertyOptional({
    description: 'Optional inclusive UTC lower bound for `performedAt` (ISO 8601).',
    format: 'date-time',
  })
  public from?: string;

  @ApiPropertyOptional({
    description: 'Optional inclusive UTC upper bound for `performedAt` (ISO 8601); must be ≥ `from`.',
    format: 'date-time',
  })
  public to?: string;

  @ApiPropertyOptional({
    description: 'Opaque keyset cursor from a previous page; omit for the first page.',
  })
  public cursor?: string;

  @ApiPropertyOptional({
    description: 'Page size (1..100).',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  public limit!: number;
  //#endregion
}
