import { ApiProperty } from '@nestjs/swagger';
import { PersonalRecordMetricDto } from './personal-record-metric.dto';

/**
 * One side (current or previous) of the PR comparison (F8): the period's UTC `[periodStart, periodEnd)`
 * boundaries and its three personal records (each in the requested unit, or `null` when the period has
 * no sets — empty-but-not-an-error).
 */
export class PersonalRecordPeriodDto {
  //#region Properties
  @ApiProperty({ description: 'Inclusive UTC start of the period (ISO 8601).' })
  public periodStart: Date;

  @ApiProperty({ description: 'Exclusive UTC end of the period (ISO 8601).' })
  public periodEnd: Date;

  @ApiProperty({
    description: 'Heaviest single set in the period, or null when there are no sets.',
    type: () => PersonalRecordMetricDto,
    nullable: true,
  })
  public maxWeight: PersonalRecordMetricDto | null;

  @ApiProperty({
    description: 'Highest-volume set in the period, or null when there are no sets.',
    type: () => PersonalRecordMetricDto,
    nullable: true,
  })
  public maxVolume: PersonalRecordMetricDto | null;

  @ApiProperty({
    description: 'Best estimated 1RM (Epley) in the period, or null when there are no sets.',
    type: () => PersonalRecordMetricDto,
    nullable: true,
  })
  public best1Rm: PersonalRecordMetricDto | null;
  //#endregion

  //#region Constructor
  public constructor(
    periodStart: Date,
    periodEnd: Date,
    maxWeight: PersonalRecordMetricDto | null,
    maxVolume: PersonalRecordMetricDto | null,
    best1Rm: PersonalRecordMetricDto | null,
  ) {
    this.periodStart = periodStart;
    this.periodEnd = periodEnd;
    this.maxWeight = maxWeight;
    this.maxVolume = maxVolume;
    this.best1Rm = best1Rm;
  }
  //#endregion
}
