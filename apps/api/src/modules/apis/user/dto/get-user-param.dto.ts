import { ApiProperty } from '@nestjs/swagger';

/**
 * Route parameters for `GET /api/users/:id`.
 */
export class GetUserParamDto {
  //#region Properties
  @ApiProperty({ description: 'The user id (UUID).', format: 'uuid' })
  public id!: string;
  //#endregion
}
