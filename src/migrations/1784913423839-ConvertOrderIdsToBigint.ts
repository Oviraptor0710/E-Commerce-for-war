import { MigrationInterface, QueryRunner } from 'typeorm';

type ForeignKeyDefinition = {
  name: string;
  table: string;
  column: string;
  referencedTable: string;
  referencedColumn: string;
  onDelete?: 'RESTRICT' | 'NO ACTION';
};

const foreignKeys: ForeignKeyDefinition[] = [
  {
    name: 'fk_order_items_order',
    table: 'order_items',
    column: 'order_id',
    referencedTable: 'orders',
    referencedColumn: 'id',
    onDelete: 'RESTRICT',
  },
  {
    name: 'fk_shipping_order',
    table: 'shipping',
    column: 'order_id',
    referencedTable: 'orders',
    referencedColumn: 'id',
  },
  {
    name: 'fk_refunds_order',
    table: 'refunds',
    column: 'order_id',
    referencedTable: 'orders',
    referencedColumn: 'id',
    onDelete: 'RESTRICT',
  },
  {
    name: 'fk_order_timelines_order',
    table: 'order_timelines',
    column: 'order_id',
    referencedTable: 'orders',
    referencedColumn: 'id',
  },
  {
    name: 'fk_rates_purchase_order',
    table: 'rates',
    column: 'purchase_id',
    referencedTable: 'orders',
    referencedColumn: 'id',
    onDelete: 'RESTRICT',
  },
];

const bigintColumns: Array<{
  table: string;
  column: string;
  nullable: boolean;
  autoIncrement?: boolean;
}> = [
  { table: 'orders', column: 'id', nullable: false, autoIncrement: true },
  { table: 'order_items', column: 'order_id', nullable: false },
  { table: 'shipping', column: 'id', nullable: false, autoIncrement: true },
  { table: 'shipping', column: 'order_id', nullable: false },
  { table: 'refunds', column: 'order_id', nullable: false },
  { table: 'order_timelines', column: 'order_id', nullable: false },
  { table: 'rates', column: 'purchase_id', nullable: true },
];

export class ConvertOrderIdsToBigint1784913423839
  implements MigrationInterface
{
  name = 'ConvertOrderIdsToBigint1784913423839';

  private async hasTable(
    queryRunner: QueryRunner,
    tableName: string,
  ): Promise<boolean> {
    const rows = await queryRunner.query(
      `SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [tableName],
    );
    return Number(rows[0]?.count ?? 0) > 0;
  }

  private async hasConstraint(
    queryRunner: QueryRunner,
    constraintName: string,
  ): Promise<boolean> {
    const rows = await queryRunner.query(
      `SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
       WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = ?`,
      [constraintName],
    );
    return Number(rows[0]?.count ?? 0) > 0;
  }

  private async dropForeignKeys(queryRunner: QueryRunner): Promise<void> {
    const targetColumns = new Set(
      foreignKeys.map((foreignKey) =>
        `${foreignKey.table}.${foreignKey.column}`.toLowerCase(),
      ),
    );
    const rows = await queryRunner.query(
      `SELECT DISTINCT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME
       FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE()
         AND REFERENCED_TABLE_NAME IS NOT NULL`,
    );

    for (const row of rows as Array<{
      TABLE_NAME: string;
      COLUMN_NAME: string;
      CONSTRAINT_NAME: string;
    }>) {
      const key = `${row.TABLE_NAME}.${row.COLUMN_NAME}`.toLowerCase();
      if (!targetColumns.has(key)) continue;

      const table = row.TABLE_NAME.replace(/`/g, '``');
      const constraint = row.CONSTRAINT_NAME.replace(/`/g, '``');
      await queryRunner.query(
        `ALTER TABLE \`${table}\` DROP FOREIGN KEY \`${constraint}\``,
      );
    }
  }

  private async modifyColumns(
    queryRunner: QueryRunner,
    type: 'BIGINT' | 'INT',
  ): Promise<void> {
    for (const column of bigintColumns) {
      if (!(await this.hasTable(queryRunner, column.table))) continue;

      const nullable = column.nullable ? 'NULL' : 'NOT NULL';
      const autoIncrement = column.autoIncrement ? ' AUTO_INCREMENT' : '';
      await queryRunner.query(
        `ALTER TABLE \`${column.table}\` MODIFY COLUMN \`${column.column}\` ${type} ${nullable}${autoIncrement}`,
      );
    }
  }

  private async applyForeignKeys(queryRunner: QueryRunner): Promise<void> {
    for (const foreignKey of foreignKeys) {
      if (!(await this.hasTable(queryRunner, foreignKey.table))) continue;
      if (await this.hasConstraint(queryRunner, foreignKey.name)) continue;

      const onDelete = foreignKey.onDelete
        ? ` ON DELETE ${foreignKey.onDelete}`
        : '';
      await queryRunner.query(
        `ALTER TABLE \`${foreignKey.table}\`
         ADD CONSTRAINT \`${foreignKey.name}\`
         FOREIGN KEY (\`${foreignKey.column}\`)
         REFERENCES \`${foreignKey.referencedTable}\` (\`${foreignKey.referencedColumn}\`)${onDelete}`,
      );
    }
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.dropForeignKeys(queryRunner);
    await this.modifyColumns(queryRunner, 'BIGINT');
    await this.applyForeignKeys(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.dropForeignKeys(queryRunner);
    await this.modifyColumns(queryRunner, 'INT');

    for (const foreignKey of foreignKeys) {
      if (!(await this.hasTable(queryRunner, foreignKey.table))) continue;
      if (await this.hasConstraint(queryRunner, foreignKey.name)) continue;

      const onDelete = foreignKey.onDelete
        ? ` ON DELETE ${foreignKey.onDelete}`
        : '';
      await queryRunner.query(
        `ALTER TABLE \`${foreignKey.table}\`
         ADD CONSTRAINT \`${foreignKey.name}\`
         FOREIGN KEY (\`${foreignKey.column}\`)
         REFERENCES \`${foreignKey.referencedTable}\` (\`${foreignKey.referencedColumn}\`)${onDelete}`,
      );
    }
  }
}
