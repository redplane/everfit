import { ApiProperty } from '@nestjs/swagger';
import { UserEntity } from '../../../cores/user/entities/user.entity';

/**
 * Response shape for a user. Minimal master-data projection (F2) — id, display name, and when the
 * record was created.
 */
export class UserDto {
  //#region Properties
  @ApiProperty({ description: 'The user id (UUID).', format: 'uuid' })
  public id: string;

  @ApiProperty({ description: 'The user display name.' })
  public name: string;

  @ApiProperty({ description: 'When the user record was created (UTC).', format: 'date-time' })
  public createdTime: Date;
  //#endregion

  //#region Constructor
  public constructor(id: string, name: string, createdTime: Date) {
    this.id = id;
    this.name = name;
    this.createdTime = createdTime;
  }
  //#endregion

  //#region Methods
  public static fromEntity(entity: UserEntity): UserDto {
    return new UserDto(entity.id, entity.name, entity.createdTime);
  }
  //#endregion
}
