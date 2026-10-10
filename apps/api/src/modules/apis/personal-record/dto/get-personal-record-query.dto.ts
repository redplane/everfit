import { ApiProperty } from '@nestjs/swagger';

/**
 * Query parameters for `GET /api/personal-record` (F7): the user and exercise to aggregate, plus the
 * **required** output weight `unit` (no default — omission is a 400).
 */
export class GetPersonalRecordQueryDto {
  //#region Properties
  @ApiProperty({ description: 'The user whose records are requested (UUID).', format: 'uuid' })
  public userId!: string;

  @ApiProperty({ description: 'The exercise to compute records for (UUID).', format: 'uuid' })
  public exerciseId!: string;

  @ApiProperty({
    description: "Required output weight unit code ('kg' / 'lb'); record weights are converted to it.",
  })
  public unit!: string;
  //#endregion
}
