import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
} from 'typeorm';
import { IMutableEntity } from '../../../../common/entities/mutable-entity.interface';
import { ExerciseEntity } from './exercise.entity';
import { MuscleGroupEntity } from './muscle-group.entity';

/**
 * Join record for the configurable many-to-many exercise↔muscle-group mapping (F3). One exercise
 * may map to many muscle groups and vice versa; the `(exercise_id, muscle_group_id)` pair is unique
 * so a duplicate mapping is rejected (never silently duplicated). The
 * `(muscle_group_id, exercise_id)` index backs the history muscle-group filter (F6: "which
 * exercises belong to this muscle group").
 */
@Entity({ name: 'exercise_muscle_groups' })
@Unique('uq_exercise_muscle_groups_exercise_id_muscle_group_id', ['exerciseId', 'muscleGroupId'])
@Index('ix_exercise_muscle_groups_muscle_group_id', ['muscleGroupId', 'exerciseId'])
export class ExerciseMuscleGroupEntity implements IMutableEntity {
  //#region Properties
  @PrimaryColumn({
    name: 'id',
    type: 'uuid',
    primaryKeyConstraintName: 'pk_exercise_muscle_groups',
  })
  public readonly id: string;

  @Column({ name: 'exercise_id', type: 'uuid' })
  public exerciseId: string;

  @Column({ name: 'muscle_group_id', type: 'uuid' })
  public muscleGroupId: string;

  @Column({ name: 'created_time', type: 'timestamptz' })
  public readonly createdTime: Date;

  @Column({ name: 'updated_time', type: 'timestamptz', nullable: true })
  public updatedTime: Date | undefined = undefined;

  @ManyToOne(() => ExerciseEntity, (exercise) => exercise.exerciseMuscleGroups)
  @JoinColumn({
    name: 'exercise_id',
    foreignKeyConstraintName: 'fk_exercise_muscle_groups_exercise_id',
  })
  public exercise?: ExerciseEntity;

  @ManyToOne(() => MuscleGroupEntity)
  @JoinColumn({
    name: 'muscle_group_id',
    foreignKeyConstraintName: 'fk_exercise_muscle_groups_muscle_group_id',
  })
  public muscleGroup?: MuscleGroupEntity;
  //#endregion

  //#region Constructor
  public constructor(id: string, exerciseId: string, muscleGroupId: string, createdTime: Date) {
    this.id = id;
    this.exerciseId = exerciseId;
    this.muscleGroupId = muscleGroupId;
    this.createdTime = createdTime;
  }
  //#endregion
}
