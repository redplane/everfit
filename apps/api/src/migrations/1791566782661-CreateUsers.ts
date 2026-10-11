import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * Creates the `users` master-data table (F2): a UUID v7 primary key (`pk_users`, supplied by the
 * application), a display name, and create/update timestamps stored as `timestamptz`. No extra
 * indexes — lookups are by primary key.
 */
export class CreateUsers1791566782661 implements MigrationInterface {
  //#region Properties
  private readonly __table = new Table({
    name: 'users',
    columns: [
      {
        name: 'id',
        type: 'uuid',
        isPrimary: true,
        primaryKeyConstraintName: 'pk_users',
      },
      {
        name: 'name',
        type: 'varchar',
        length: '200',
        isNullable: false,
      },
      {
        name: 'created_time',
        type: 'timestamptz',
        isNullable: false,
      },
      {
        name: 'updated_time',
        type: 'timestamptz',
        isNullable: true,
      },
    ],
  });
  //#endregion

  //#region Methods
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(this.__table, true);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(this.__table, true);
  }
  //#endregion
}
