import { Column, Entity, Index, OneToMany, PrimaryColumn } from 'typeorm';
import { IMutableEntity } from '../../../../common/entities/mutable-entity.interface';
import { ExerciseMuscleGroupEntity } from './exercise-muscle-group.entity';

/**
 * Exercise catalogue master-data record (F3). Logs reference a real exercise (no free-text
 * create-on-first-use), and history can be filtered by the exercise's name or mapped muscle groups.
 * Read-only discovery this sprint; the catalogue is populated by the seed CLI (Task 9). The
 * exercise↔muscle-group relation is relational configuration, resolved through the join entity —
 * not hardcoded business logic.
 */
@Entity({ name: 'exercises' })
export class ExerciseEntity implements IMutableEntity {
  //#region Properties
  @PrimaryColumn({ name: 'id', type: 'uuid', primaryKeyConstraintName: 'pk_exercises' })
  public readonly id: string;

  @Index('uq_exercises_name', { unique: true })
  @Column({ name: 'name', type: 'varchar', length: 200 })
  public name: string;

  @Column({ name: 'created_time', type: 'timestamptz' })
  public readonly createdTime: Date;

  @Column({ name: 'updated_time', type: 'timestamptz', nullable: true })
  public updatedTime: Date | undefined = undefined;

  /**
   * Inverse side of the M:N mapping. Eager-loaded by `IExerciseService.searchAsync` so each
   * exercise can report its mapped muscle groups.
   */
  @OneToMany(() => ExerciseMuscleGroupEntity, (mapping) => mapping.exercise)
  public exerciseMuscleGroups?: ExerciseMuscleGroupEntity[];
  //#endregion

  //#region Constructor
  public constructor(id: string, name: string, createdTime: Date) {
    this.id = id;
    this.name = name;
    this.createdTime = createdTime;
  }
  //#endregion
}
