import { ApiProperty } from '@nestjs/swagger';
import { PersonalRecordDeltaDirection } from '../../../../models/results/personal-record-delta-direction';

/**
 * The server-computed delta for one PR metric between the current and previous period (F8). The delta
 * is computed on normalized kg and the `absolute` is converted to the requested unit for display (2 dp).
 * `absolute`/`percent` are `null` whenever the comparison is not a plain numeric difference (see
 * `direction`: `new`, `none`, or both-null `same`).
 */
export class PersonalRecordDeltaDto {
  //#region Properties
  @ApiProperty({
    description:
      'Current minus previous, in the requested unit (2 dp). Null when current or previous is absent.',
    nullable: true,
  })
  public absolute: number | null;

  @ApiProperty({
    description:
      'Percent change relative to previous ((absolute / previous) × 100, 2 dp). Null when previous ' +
      'is absent (no divide-by-zero).',
    nullable: true,
  })
  public percent: number | null;

  @ApiProperty({
    description:
      "Direction of change: 'up'/'down'/'same' when both present; 'new' when previous is absent; " +
      "'none' when current is absent but previous was present.",
    enum: PersonalRecordDeltaDirection,
  })
  public direction: PersonalRecordDeltaDirection;
  //#endregion

  //#region Constructor
  public constructor(
    absolute: number | null,
    percent: number | null,
    direction: PersonalRecordDeltaDirection,
  ) {
    this.absolute = absolute;
    this.percent = percent;
    this.direction = direction;
  }
  //#endregion
}
