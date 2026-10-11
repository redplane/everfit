import { Column, Entity, PrimaryColumn } from 'typeorm';
import { IMutableEntity } from '../../../../common/entities/mutable-entity.interface';

/**
 * Master-data record for a user (coach's client). Minimal by design (F2): it exists only so
 * reads/logging can validate that a `userId` refers to a real, known record and distinguish an
 * unknown user (404 `USER_NOT_FOUND`) from a known user with no data (empty result). No profile
 * management this sprint.
 */
@Entity({ name: 'users' })
export class UserEntity implements IMutableEntity {
  //#region Properties
  @PrimaryColumn({ name: 'id', type: 'uuid', primaryKeyConstraintName: 'pk_users' })
  public readonly id: string;

  @Column({ name: 'name', type: 'varchar', length: 200 })
  public name: string;

  @Column({ name: 'created_time', type: 'timestamptz' })
  public readonly createdTime: Date;

  @Column({ name: 'updated_time', type: 'timestamptz', nullable: true })
  public updatedTime: Date | undefined = undefined;
  //#endregion

  //#region Constructor
  public constructor(id: string, name: string, createdTime: Date) {
    this.id = id;
    this.name = name;
    this.createdTime = createdTime;
  }
  //#endregion
}
