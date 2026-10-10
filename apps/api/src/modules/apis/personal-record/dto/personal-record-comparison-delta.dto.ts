import { ApiProperty } from '@nestjs/swagger';
import { PersonalRecordDeltaDto } from './personal-record-delta.dto';

/**
 * The three per-metric deltas of a PR comparison (F8), grouped for clean typing. Each is the current-
 * vs-previous delta for that metric (see `PersonalRecordDeltaDto`).
 */
export class PersonalRecordComparisonDeltaDto {
  //#region Properties
  @ApiProperty({ description: 'Delta for the max-weight PR.', type: () => PersonalRecordDeltaDto })
  public maxWeight: PersonalRecordDeltaDto;

  @ApiProperty({ description: 'Delta for the max-volume PR.', type: () => PersonalRecordDeltaDto })
  public maxVolume: PersonalRecordDeltaDto;

  @ApiProperty({ description: 'Delta for the best-1RM PR.', type: () => PersonalRecordDeltaDto })
  public best1Rm: PersonalRecordDeltaDto;
  //#endregion

  //#region Constructor
  public constructor(
    maxWeight: PersonalRecordDeltaDto,
    maxVolume: PersonalRecordDeltaDto,
    best1Rm: PersonalRecordDeltaDto,
  ) {
    this.maxWeight = maxWeight;
    this.maxVolume = maxVolume;
    this.best1Rm = best1Rm;
  }
  //#endregion
}
