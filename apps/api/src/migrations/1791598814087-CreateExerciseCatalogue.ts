import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

/**
 * Creates the exercise catalogue (F3): `exercises` and `muscle_groups` master-data tables plus the
 * `exercise_muscle_groups` join that models the configurable many-to-many mapping between them. The
 * `(exercise_id, muscle_group_id)` pair is unique so a duplicate mapping is rejected, and a
 * `(muscle_group_id, exercise_id)` index backs the history muscle-group filter (F6). All ids are
 * application-supplied UUID v7; timestamps are `timestamptz`.
 */
export class CreateExerciseCatalogue1791598814087 implements MigrationInterface {
  //#region Properties
  private readonly __exercisesTable = new Table({
    name: 'exercises',
    columns: [
      { name: 'id', type: 'uuid', isPrimary: true, primaryKeyConstraintName: 'pk_exercises' },
      { name: 'name', type: 'varchar', length: '200', isNullable: false },
      { name: 'created_time', type: 'timestamptz', isNullable: false },
      { name: 'updated_time', type: 'timestamptz', isNullable: true },
    ],
  });

  private readonly __muscleGroupsTable = new Table({
    name: 'muscle_groups',
    columns: [
      { name: 'id', type: 'uuid', isPrimary: true, primaryKeyConstraintName: 'pk_muscle_groups' },
      { name: 'name', type: 'varchar', length: '200', isNullable: false },
      { name: 'created_time', type: 'timestamptz', isNullable: false },
      { name: 'updated_time', type: 'timestamptz', isNullable: true },
    ],
  });

  private readonly __exerciseMuscleGroupsTable = new Table({
    name: 'exercise_muscle_groups',
    columns: [
      {
        name: 'id',
        type: 'uuid',
        isPrimary: true,
        primaryKeyConstraintName: 'pk_exercise_muscle_groups',
      },
      { name: 'exercise_id', type: 'uuid', isNullable: false },
      { name: 'muscle_group_id', type: 'uuid', isNullable: false },
      { name: 'created_time', type: 'timestamptz', isNullable: false },
      { name: 'updated_time', type: 'timestamptz', isNullable: true },
    ],
  });
  //#endregion

  //#region Methods
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(this.__exercisesTable, true);
    await queryRunner.createTable(this.__muscleGroupsTable, true);
    await queryRunner.createTable(this.__exerciseMuscleGroupsTable, true);

    // Unique exercise name.
    await queryRunner.createIndex(
      'exercises',
      new TableIndex({
        name: 'uq_exercises_name',
        columnNames: ['name'],
        isUnique: true,
      }),
    );

    // Unique muscle-group name.
    await queryRunner.createIndex(
      'muscle_groups',
      new TableIndex({
        name: 'uq_muscle_groups_name',
        columnNames: ['name'],
        isUnique: true,
      }),
    );

    // Unique mapping pair — a duplicate (exercise, muscle group) is rejected.
    await queryRunner.createIndex(
      'exercise_muscle_groups',
      new TableIndex({
        name: 'uq_exercise_muscle_groups_exercise_id_muscle_group_id',
        columnNames: ['exercise_id', 'muscle_group_id'],
        isUnique: true,
      }),
    );

    // Muscle-group-first lookup index for the history muscle-group filter (F6).
    await queryRunner.createIndex(
      'exercise_muscle_groups',
      new TableIndex({
        name: 'ix_exercise_muscle_groups_muscle_group_id',
        columnNames: ['muscle_group_id', 'exercise_id'],
      }),
    );

    await queryRunner.createForeignKey(
      'exercise_muscle_groups',
      new TableForeignKey({
        name: 'fk_exercise_muscle_groups_exercise_id',
        columnNames: ['exercise_id'],
        referencedTableName: 'exercises',
        referencedColumnNames: ['id'],
      }),
    );

    await queryRunner.createForeignKey(
      'exercise_muscle_groups',
      new TableForeignKey({
        name: 'fk_exercise_muscle_groups_muscle_group_id',
        columnNames: ['muscle_group_id'],
        referencedTableName: 'muscle_groups',
        referencedColumnNames: ['id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the join table first (it holds the FKs), then the master tables.
    await queryRunner.dropTable(this.__exerciseMuscleGroupsTable, true);
    await queryRunner.dropTable(this.__muscleGroupsTable, true);
    await queryRunner.dropTable(this.__exercisesTable, true);
  }
  //#endregion
}
