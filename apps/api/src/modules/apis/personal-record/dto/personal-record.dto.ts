import { ApiProperty } from '@nestjs/swagger';
import { PersonalRecordMetricDto } from './personal-record-metric.dto';

/**
 * Response shape for `GET /api/personal-record` (F7): the scope (`userId` + `exerciseId`), the output
 * `unit`, and the three personal records. Each metric is `null` when the (known) user has no sets for
 * the (known) exercise — empty-but-not-an-error.
 */
export class PersonalRecordDto {
  //#region Properties
  @ApiProperty({ description: 'The user the records are for (UUID).', format: 'uuid' })
  public userId: string;

  @ApiProperty({ description: 'The exercise the records are for (UUID).', format: 'uuid' })
  public exerciseId: string;

  @ApiProperty({ description: "The output unit the record weights are expressed in ('kg' / 'lb')." })
  public unit: string;

  @ApiProperty({
    description: 'Heaviest single set (max weight), or null when there are no sets.',
    type: () => PersonalRecordMetricDto,
    nullable: true,
  })
  public maxWeight: PersonalRecordMetricDto | null;

  @ApiProperty({
    description: 'Highest-volume set (reps × weight), or null when there are no sets.',
    type: () => PersonalRecordMetricDto,
    nullable: true,
  })
  public maxVolume: PersonalRecordMetricDto | null;

  @ApiProperty({
    description: 'Best estimated 1RM (Epley), or null when there are no sets.',
    type: () => PersonalRecordMetricDto,
    nullable: true,
  })
  public best1Rm: PersonalRecordMetricDto | null;
  //#endregion

  //#region Constructor
  public constructor(
    userId: string,
    exerciseId: string,
    unit: string,
    maxWeight: PersonalRecordMetricDto | null,
    maxVolume: PersonalRecordMetricDto | null,
    best1Rm: PersonalRecordMetricDto | null,
  ) {
    this.userId = userId;
    this.exerciseId = exerciseId;
    this.unit = unit;
    this.maxWeight = maxWeight;
    this.maxVolume = maxVolume;
    this.best1Rm = best1Rm;
  }
  //#endregion
}
