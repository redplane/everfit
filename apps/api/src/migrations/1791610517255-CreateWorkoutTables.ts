import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

/**
 * Creates the workout data model (F5): the parent `workout_entries` table and the row-per-set
 * `workout_sets` fact table. Sets carry the parent FK plus denormalized `user_id`, `exercise_id`,
 * `performed_at` (no FK on the denormalized copies — human-approved; they are kept correct by the
 * single write transaction, §8) so PR aggregation (F7/F8) and the uniqueness constraint need no join.
 *
 * Besides the duplicate-rejection unique constraint, this migration also lands the history (F6) and
 * PR (F7/F8) read indexes up front (per Task 5's architecture-design), including the DESC-ordered and
 * computed-expression indexes that TypeORM decorators cannot express — those are created with raw SQL.
 */
export class CreateWorkoutTables1791610517255 implements MigrationInterface {
  //#region Properties
  private readonly __workoutEntriesTable = new Table({
    name: 'workout_entries',
    columns: [
      {
        name: 'id',
        type: 'uuid',
        isPrimary: true,
        primaryKeyConstraintName: 'pk_workout_entries',
      },
      { name: 'user_id', type: 'uuid', isNullable: false },
      { name: 'exercise_id', type: 'uuid', isNullable: false },
      { name: 'performed_at', type: 'timestamptz', isNullable: false },
      { name: 'created_time', type: 'timestamptz', isNullable: false },
    ],
  });

  private readonly __workoutSetsTable = new Table({
    name: 'workout_sets',
    columns: [
      { name: 'id', type: 'uuid', isPrimary: true, primaryKeyConstraintName: 'pk_workout_sets' },
      { name: 'workout_entry_id', type: 'uuid', isNullable: false },
      { name: 'user_id', type: 'uuid', isNullable: false },
      { name: 'exercise_id', type: 'uuid', isNullable: false },
      { name: 'performed_at', type: 'timestamptz', isNullable: false },
      { name: 'set_number', type: 'smallint', isNullable: false },
      { name: 'reps', type: 'integer', isNullable: false },
      { name: 'weight', type: 'numeric', precision: 7, scale: 3, isNullable: false },
      { name: 'unit', type: 'varchar', length: '8', isNullable: false },
      { name: 'weight_kg', type: 'numeric', precision: 9, scale: 4, isNullable: false },
      { name: 'created_time', type: 'timestamptz', isNullable: false },
    ],
  });
  //#endregion

  //#region Methods
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(this.__workoutEntriesTable, true);
    await queryRunner.createTable(this.__workoutSetsTable, true);

    // Parent FKs (users, exercises).
    await queryRunner.createForeignKey(
      'workout_entries',
      new TableForeignKey({
        name: 'fk_workout_entries_user_id',
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
      }),
    );
    await queryRunner.createForeignKey(
      'workout_entries',
      new TableForeignKey({
        name: 'fk_workout_entries_exercise_id',
        columnNames: ['exercise_id'],
        referencedTableName: 'exercises',
        referencedColumnNames: ['id'],
      }),
    );

    // Child -> parent FK. (The denormalized user_id/exercise_id on sets are intentionally NOT
    // FK-constrained — they are transaction-guaranteed copies; see the class note.)
    await queryRunner.createForeignKey(
      'workout_sets',
      new TableForeignKey({
        name: 'fk_workout_sets_workout_entry_id',
        columnNames: ['workout_entry_id'],
        referencedTableName: 'workout_entries',
        referencedColumnNames: ['id'],
      }),
    );

    // Duplicate-rejection unique constraint (Q8): set_number distinguishes a legitimate repeated set
    // from a true duplicate.
    await queryRunner.createIndex(
      'workout_sets',
      new TableIndex({
        name: 'uq_workout_sets_user_id_exercise_id_performed_at_set_number',
        columnNames: ['user_id', 'exercise_id', 'performed_at', 'set_number'],
        isUnique: true,
      }),
    );

    // History (F6) keyset indexes over workout_entries — DESC ordering via raw SQL.
    await queryRunner.query(
      'CREATE INDEX "ix_workout_entries_user_id_performed_at_id" ON "workout_entries" ' +
        '("user_id", "performed_at" DESC, "id" DESC)',
    );
    await queryRunner.query(
      'CREATE INDEX "ix_workout_entries_user_id_exercise_id_performed_at" ON "workout_entries" ' +
        '("user_id", "exercise_id", "performed_at" DESC)',
    );

    // PR (F7/F8) top-1 indexes over workout_sets. The volume and Epley indexes are computed
    // expressions; all are DESC — hence raw SQL (TypeORM decorators cannot express either).
    await queryRunner.query(
      'CREATE INDEX "ix_workout_sets_user_id_exercise_id_weight_kg" ON "workout_sets" ' +
        '("user_id", "exercise_id", "weight_kg" DESC)',
    );
    await queryRunner.query(
      'CREATE INDEX "ix_workout_sets_user_id_exercise_id_volume" ON "workout_sets" ' +
        '("user_id", "exercise_id", ((reps * weight_kg)) DESC)',
    );
    await queryRunner.query(
      'CREATE INDEX "ix_workout_sets_user_id_exercise_id_epley" ON "workout_sets" ' +
        '("user_id", "exercise_id", ((weight_kg * (1 + reps / 30.0))) DESC)',
    );
    await queryRunner.query(
      'CREATE INDEX "ix_workout_sets_user_id_exercise_id_performed_at" ON "workout_sets" ' +
        '("user_id", "exercise_id", "performed_at" DESC)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the child table first (it holds the FK to the parent), then the parent. Dropping the
    // tables cascades their indexes and constraints.
    await queryRunner.dropTable(this.__workoutSetsTable, true);
    await queryRunner.dropTable(this.__workoutEntriesTable, true);
  }
  //#endregion
}
