import { Column, Entity, Index, OneToMany, PrimaryColumn } from 'typeorm';
import { IImmutableEntity } from '../../../../common/entities/immutable-entity.interface';
import { WorkoutSetEntity } from './workout-set.entity';

/**
 * Parent grouping row for one logged `(user, exercise, instant)` — the unit of one exercise in one
 * log action and the paginated unit of history (F6, "50k+ entries" counts these). Immutable:
 * workouts are append-only this sprint (no edit/delete), so there is no `updated_time`.
 */
@Entity({ name: 'workout_entries' })
@Index('ix_workout_entries_user_id_performed_at_id', ['userId', 'performedAt', 'id'])
@Index('ix_workout_entries_user_id_exercise_id_performed_at', ['userId', 'exerciseId', 'performedAt'])
export class WorkoutEntryEntity implements IImmutableEntity {
  //#region Properties
  @PrimaryColumn({ name: 'id', type: 'uuid', primaryKeyConstraintName: 'pk_workout_entries' })
  public readonly id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  public userId: string;

  @Column({ name: 'exercise_id', type: 'uuid' })
  public exerciseId: string;

  @Column({ name: 'performed_at', type: 'timestamptz' })
  public performedAt: Date;

  @Column({ name: 'created_time', type: 'timestamptz' })
  public readonly createdTime: Date;

  // FK constraints to users/exercises are declared in the migration. Entity-level @ManyToOne
  // relations to User/Exercise are intentionally omitted: the design is denormalized (no joins on the
  // hot read paths), and omitting them keeps data-access specs from having to register unrelated
  // entity metadata. The entry↔set relation below is kept (both are workout-core entities).

  /** The row-per-set children grouped under this entry. */
  @OneToMany(() => WorkoutSetEntity, (set) => set.workoutEntry)
  public sets?: WorkoutSetEntity[];
  //#endregion

  //#region Constructor
  public constructor(
    id: string,
    userId: string,
    exerciseId: string,
    performedAt: Date,
    createdTime: Date,
  ) {
    this.id = id;
    this.userId = userId;
    this.exerciseId = exerciseId;
    this.performedAt = performedAt;
    this.createdTime = createdTime;
  }
  //#endregion
}
