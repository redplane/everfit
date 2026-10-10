import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, Unique } from 'typeorm';
import { IImmutableEntity } from '../../../../common/entities/immutable-entity.interface';
import { ColumnNumericTransformer } from '../../../../common/entities/column-numeric.transformer';
import { WorkoutEntryEntity } from './workout-entry.entity';

const numericTransformer = new ColumnNumericTransformer();

/**
 * The queryable fact row — one per set (row-per-set, Q1). Carries the parent FK plus **denormalized**
 * `user_id`, `exercise_id`, `performed_at` (copied from the parent in the same write transaction) so
 * PR aggregation (F7/F8) and the uniqueness constraint need no join. Stores both what the coach
 * entered (`weight` + `unit`) and the normalized `weight_kg` (§2.7.1). Immutable (append-only).
 *
 * The denormalized `user_id` / `exercise_id` deliberately have **no FK** (human-approved): they are
 * copies kept correct by the single write transaction; only `workout_entry_id` carries a FK.
 */
@Entity({ name: 'workout_sets' })
// Duplicate-rejection unique constraint (Q8): set_number distinguishes a legitimate repeated set
// from a true duplicate. Denormalized onto the set so re-sending the same batch as a new parent with
// the same performed_at still collides — race-safe at the DB.
@Unique('uq_workout_sets_user_id_exercise_id_performed_at_set_number', [
  'userId',
  'exerciseId',
  'performedAt',
  'setNumber',
])
export class WorkoutSetEntity implements IImmutableEntity {
  //#region Properties
  @PrimaryColumn({ name: 'id', type: 'uuid', primaryKeyConstraintName: 'pk_workout_sets' })
  public readonly id: string;

  @Column({ name: 'workout_entry_id', type: 'uuid' })
  public workoutEntryId: string;

  // The PR aggregation indexes on (user_id, exercise_id, ...) — incl. the DESC and expression
  // indexes (weight_kg, reps*weight_kg, Epley) — are declared in the CreateWorkoutTables migration
  // via raw SQL, since TypeORM decorators cannot express per-column sort direction or computed
  // expressions. `synchronize` is off, so entity decorators are metadata only.
  @Column({ name: 'user_id', type: 'uuid' })
  public userId: string;

  @Column({ name: 'exercise_id', type: 'uuid' })
  public exerciseId: string;

  @Column({ name: 'performed_at', type: 'timestamptz' })
  public performedAt: Date;

  @Column({ name: 'set_number', type: 'smallint' })
  public setNumber: number;

  @Column({ name: 'reps', type: 'integer' })
  public reps: number;

  @Column({
    name: 'weight',
    type: 'numeric',
    precision: 7,
    scale: 3,
    transformer: numericTransformer,
  })
  public weight: number;

  @Column({ name: 'unit', type: 'varchar', length: 8 })
  public unit: string;

  @Column({
    name: 'weight_kg',
    type: 'numeric',
    precision: 9,
    scale: 4,
    transformer: numericTransformer,
  })
  public weightKg: number;

  @Column({ name: 'created_time', type: 'timestamptz' })
  public readonly createdTime: Date;

  @ManyToOne(() => WorkoutEntryEntity, (entry) => entry.sets)
  @JoinColumn({
    name: 'workout_entry_id',
    foreignKeyConstraintName: 'fk_workout_sets_workout_entry_id',
  })
  public workoutEntry?: WorkoutEntryEntity;
  //#endregion

  //#region Constructor
  public constructor(
    id: string,
    workoutEntryId: string,
    userId: string,
    exerciseId: string,
    performedAt: Date,
    setNumber: number,
    reps: number,
    weight: number,
    unit: string,
    weightKg: number,
    createdTime: Date,
  ) {
    this.id = id;
    this.workoutEntryId = workoutEntryId;
    this.userId = userId;
    this.exerciseId = exerciseId;
    this.performedAt = performedAt;
    this.setNumber = setNumber;
    this.reps = reps;
    this.weight = weight;
    this.unit = unit;
    this.weightKg = weightKg;
    this.createdTime = createdTime;
  }
  //#endregion
}
