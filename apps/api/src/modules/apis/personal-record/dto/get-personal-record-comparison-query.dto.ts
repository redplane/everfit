import { ApiProperty } from '@nestjs/swagger';
import { PeriodGranularity } from '../../../../models/periods/period-granularity';

/**
 * Query parameters for `GET /api/personal-record/comparison` (F8): the user and exercise to aggregate,
 * the period `granularity` to compare (current vs immediately preceding), the IANA `timezone` the
 * period boundaries are derived in, and the **required** output weight `unit`. All four non-id params
 * are required — omission is a 400.
 */
export class GetPersonalRecordComparisonQueryDto {
  //#region Properties
  @ApiProperty({ description: 'The user whose records are compared (UUID).', format: 'uuid' })
  public userId!: string;

  @ApiProperty({ description: 'The exercise to compute records for (UUID).', format: 'uuid' })
  public exerciseId!: string;

  @ApiProperty({
    description: 'The period granularity to compare (current vs the immediately preceding period).',
    enum: PeriodGranularity,
  })
  public granularity!: PeriodGranularity;

  @ApiProperty({
    description:
      'Required IANA timezone the period boundaries are computed in (e.g. "Asia/Ho_Chi_Minh"). ' +
      'Boundaries are local wall-clock starts converted to UTC.',
    example: 'Asia/Ho_Chi_Minh',
  })
  public timezone!: string;

  @ApiProperty({
    description: "Required output weight unit code ('kg' / 'lb'); record weights are converted to it.",
  })
  public unit!: string;
  //#endregion
}
