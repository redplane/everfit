import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { IMutableEntity } from '../../../../common/entities/mutable-entity.interface';

/**
 * Muscle-group master-data record (F3). Provides the valid values a caller can discover for the
 * history muscle-group filter (F6). Read-only discovery this sprint; populated by the seed CLI
 * (Task 9).
 */
@Entity({ name: 'muscle_groups' })
export class MuscleGroupEntity implements IMutableEntity {
  //#region Properties
  @PrimaryColumn({ name: 'id', type: 'uuid', primaryKeyConstraintName: 'pk_muscle_groups' })
  public readonly id: string;

  @Index('uq_muscle_groups_name', { unique: true })
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
