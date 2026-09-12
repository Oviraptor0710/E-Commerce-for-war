import { MigrationInterface, QueryRunner } from 'typeorm';

type UserIdentityColumn = {
  tableName: string;
  columnName: string;
  nullable: boolean;
  constraintName: string;
};

export class FinalizeUserIdentityForeignKeys1784913423836 implements MigrationInterface {
  name = 'FinalizeUserIdentityForeignKeys1784913423836';

  private readonly columns: UserIdentityColumn[] = [
    {
      tableName: 'rates',
      columnName: 'user_id',
      nullable: false,
      constraintName: 'fk_rates_user',
    },
    {
      tableName: 'rates',
      columnName: 'reviewer_id',
      nullable: true,
      constraintName: 'fk_rates_reviewer',
    },
    {
      tableName: 'saved_searches',
      columnName: 'user_id',
      nullable: false,
      constraintName: 'fk_saved_searches_user',
    },
    {
      tableName: 'shipping',
      columnName: 'shipper_id',
      nullable: true,
      constraintName: 'fk_shipping_shipper',
    },
    {
      tableName: 'order_timelines',
      columnName: 'changed_by',
      nullable: true,
      constraintName: 'fk_order_timelines_changed_by',
    },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const column of this.columns) {
      if (!(await this.columnExists(queryRunner, column))) continue;

      await queryRunner.query(
        `ALTER TABLE ${this.quote(column.tableName)} MODIFY COLUMN ${this.quote(column.columnName)} BIGINT ${column.nullable ? 'NULL' : 'NOT NULL'}`,
      );

      if (!(await this.hasUserForeignKey(queryRunner, column))) {
        await queryRunner.query(
          `ALTER TABLE ${this.quote(column.tableName)}
           ADD CONSTRAINT ${this.quote(column.constraintName)}
           FOREIGN KEY (${this.quote(column.columnName)})
           REFERENCES \`users\` (\`id\`)
           ON DELETE RESTRICT ON UPDATE NO ACTION`,
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const column of [...this.columns].reverse()) {
      if (!(await this.columnExists(queryRunner, column))) continue;

      if (await this.constraintExists(queryRunner, column.constraintName)) {
        await queryRunner.query(
          `ALTER TABLE ${this.quote(column.tableName)} DROP FOREIGN KEY ${this.quote(column.constraintName)}`,
        );
      }
      await queryRunner.query(
        `ALTER TABLE ${this.quote(column.tableName)} MODIFY COLUMN ${this.quote(column.columnName)} INT ${column.nullable ? 'NULL' : 'NOT NULL'}`,
      );
    }
  }

  private async columnExists(
    queryRunner: QueryRunner,
    column: UserIdentityColumn,
  ): Promise<boolean> {
    const rows = await queryRunner.query(
      `SELECT COUNT(*) AS count
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [column.tableName, column.columnName],
    );
    return Number(rows[0]?.count ?? 0) > 0;
  }

  private async hasUserForeignKey(
    queryRunner: QueryRunner,
    column: UserIdentityColumn,
  ): Promise<boolean> {
    const rows = await queryRunner.query(
      `SELECT COUNT(*) AS count
       FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
       WHERE CONSTRAINT_SCHEMA = DATABASE()
         AND TABLE_NAME = ?
         AND COLUMN_NAME = ?
         AND REFERENCED_TABLE_NAME = 'users'
         AND REFERENCED_COLUMN_NAME = 'id'`,
      [column.tableName, column.columnName],
    );
    return Number(rows[0]?.count ?? 0) > 0;
  }

  private async constraintExists(
    queryRunner: QueryRunner,
    constraintName: string,
  ): Promise<boolean> {
    const rows = await queryRunner.query(
      `SELECT COUNT(*) AS count
       FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
       WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = ?`,
      [constraintName],
    );
    return Number(rows[0]?.count ?? 0) > 0;
  }

  private quote(identifier: string): string {
    if (!/^[A-Za-z0-9_$]+$/.test(identifier)) {
      throw new Error(`Unsafe database identifier: ${identifier}`);
    }
    return `\`${identifier}\``;
  }
}
