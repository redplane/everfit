import { ApiProperty } from '@nestjs/swagger';
import { PeriodGranularity } from '../../../../models/periods/period-granularity';
import { PersonalRecordPeriodDto } from './personal-record-period.dto';
import { PersonalRecordComparisonDeltaDto } from './personal-record-comparison-delta.dto';

/**
 * Response shape for `GET /api/personal-record/comparison` (F8): the scope (`userId` + `exerciseId`),
 * the `granularity`/`timezone`/`unit` echoed back, the side-by-side `current` and `previous` period
 * blocks, and the server-computed per-metric `delta`.
 */
export class PersonalRecordComparisonDto {
  //#region Properties
  @ApiProperty({ description: 'The user the records are for (UUID).', format: 'uuid' })
  public userId: string;

  @ApiProperty({ description: 'The exercise the records are for (UUID).', format: 'uuid' })
  public exerciseId: string;

  @ApiProperty({ description: 'The compared period granularity.', enum: PeriodGranularity })
  public granularity: PeriodGranularity;

  @ApiProperty({ description: 'The IANA timezone the period boundaries were computed in.' })
  public timezone: string;

  @ApiProperty({ description: "The output unit the record weights are expressed in ('kg' / 'lb')." })
  public unit: string;

  @ApiProperty({ description: 'The current period block.', type: () => PersonalRecordPeriodDto })
  public current: PersonalRecordPeriodDto;

  @ApiProperty({
    description: 'The immediately preceding period block.',
    type: () => PersonalRecordPeriodDto,
  })
  public previous: PersonalRecordPeriodDto;

  @ApiProperty({
    description: 'The per-metric current-vs-previous deltas.',
    type: () => PersonalRecordComparisonDeltaDto,
  })
  public delta: PersonalRecordComparisonDeltaDto;
  //#endregion

  //#region Constructor
  public constructor(
    userId: string,
    exerciseId: string,
    granularity: PeriodGranularity,
    timezone: string,
    unit: string,
    current: PersonalRecordPeriodDto,
    previous: PersonalRecordPeriodDto,
    delta: PersonalRecordComparisonDeltaDto,
  ) {
    this.userId = userId;
    this.exerciseId = exerciseId;
    this.granularity = granularity;
    this.timezone = timezone;
    this.unit = unit;
    this.current = current;
    this.previous = previous;
    this.delta = delta;
  }
  //#endregion
}
