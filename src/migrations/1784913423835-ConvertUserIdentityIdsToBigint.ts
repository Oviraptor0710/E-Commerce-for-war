import { MigrationInterface, QueryRunner } from 'typeorm';

type ForeignKeyColumn = {
  constraintName: string;
  tableName: string;
  columnName: string;
  referencedTableName: string;
  referencedColumnName: string;
  ordinalPosition: number;
  deleteRule: string;
  updateRule: string;
};

type ForeignKey = {
  constraintName: string;
  tableName: string;
  referencedTableName: string;
  deleteRule: string;
  updateRule: string;
  columns: ForeignKeyColumn[];
};

export class ConvertUserIdentityIdsToBigint1784913423835 implements MigrationInterface {
  name = 'ConvertUserIdentityIdsToBigint1784913423835';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const foreignKeys = await this.loadUserForeignKeys(queryRunner);
    await this.dropForeignKeys(queryRunner, foreignKeys);

    await queryRunner.query(
      'ALTER TABLE `users` MODIFY COLUMN `id` BIGINT NOT NULL AUTO_INCREMENT',
    );
    if (await this.tableExists(queryRunner, 'seller_profiles')) {
      await queryRunner.query(
        'ALTER TABLE `seller_profiles` MODIFY COLUMN `user_id` BIGINT NOT NULL',
      );
    }

    const alteredColumns = new Set<string>();
    for (const foreignKey of foreignKeys) {
      for (const column of foreignKey.columns) {
        const key = `${column.tableName}.${column.columnName}`;
        if (alteredColumns.has(key)) continue;
        alteredColumns.add(key);

        const nullable = await this.isNullable(
          queryRunner,
          column.tableName,
          column.columnName,
        );
        await queryRunner.query(
          `ALTER TABLE ${this.quote(column.tableName)} MODIFY COLUMN ${this.quote(column.columnName)} BIGINT ${nullable ? 'NULL' : 'NOT NULL'}`,
        );
      }
    }

    await this.restoreForeignKeys(queryRunner, foreignKeys);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const foreignKeys = await this.loadUserForeignKeys(queryRunner);
    await this.assertFitsSignedInt(queryRunner, foreignKeys);
    await this.dropForeignKeys(queryRunner, foreignKeys);

    await queryRunner.query(
      'ALTER TABLE `users` MODIFY COLUMN `id` INT NOT NULL AUTO_INCREMENT',
    );
    if (await this.tableExists(queryRunner, 'seller_profiles')) {
      await queryRunner.query(
        'ALTER TABLE `seller_profiles` MODIFY COLUMN `user_id` INT NOT NULL',
      );
    }

    const alteredColumns = new Set<string>();
    for (const foreignKey of foreignKeys) {
      for (const column of foreignKey.columns) {
        const key = `${column.tableName}.${column.columnName}`;
        if (alteredColumns.has(key)) continue;
        alteredColumns.add(key);

        const nullable = await this.isNullable(
          queryRunner,
          column.tableName,
          column.columnName,
        );
        await queryRunner.query(
          `ALTER TABLE ${this.quote(column.tableName)} MODIFY COLUMN ${this.quote(column.columnName)} INT ${nullable ? 'NULL' : 'NOT NULL'}`,
        );
      }
    }

    await this.restoreForeignKeys(queryRunner, foreignKeys);
  }

  private async loadUserForeignKeys(
    queryRunner: QueryRunner,
  ): Promise<ForeignKey[]> {
    const rows = (await queryRunner.query(
      `SELECT
         kcu.CONSTRAINT_NAME AS constraintName,
         kcu.TABLE_NAME AS tableName,
         kcu.COLUMN_NAME AS columnName,
         kcu.REFERENCED_TABLE_NAME AS referencedTableName,
         kcu.REFERENCED_COLUMN_NAME AS referencedColumnName,
         kcu.ORDINAL_POSITION AS ordinalPosition,
         rc.DELETE_RULE AS deleteRule,
         rc.UPDATE_RULE AS updateRule
       FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
       INNER JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
         ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
        AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
        AND rc.TABLE_NAME = kcu.TABLE_NAME
       WHERE kcu.CONSTRAINT_SCHEMA = DATABASE()
         AND (
           (kcu.REFERENCED_TABLE_NAME = 'users' AND kcu.REFERENCED_COLUMN_NAME = 'id')
           OR
           (kcu.REFERENCED_TABLE_NAME = 'seller_profiles' AND kcu.REFERENCED_COLUMN_NAME = 'user_id')
         )
       ORDER BY kcu.CONSTRAINT_NAME, kcu.ORDINAL_POSITION`,
    )) as ForeignKeyColumn[];

    const grouped = new Map<string, ForeignKey>();
    for (const row of rows) {
      const key = `${row.tableName}.${row.constraintName}`;
      const foreignKey = grouped.get(key) ?? {
        constraintName: row.constraintName,
        tableName: row.tableName,
        referencedTableName: row.referencedTableName,
        deleteRule: row.deleteRule,
        updateRule: row.updateRule,
        columns: [],
      };
      foreignKey.columns.push(row);
      grouped.set(key, foreignKey);
    }
    return Array.from(grouped.values());
  }

  private async dropForeignKeys(
    queryRunner: QueryRunner,
    foreignKeys: ForeignKey[],
  ): Promise<void> {
    for (const foreignKey of foreignKeys) {
      await queryRunner.query(
        `ALTER TABLE ${this.quote(foreignKey.tableName)} DROP FOREIGN KEY ${this.quote(foreignKey.constraintName)}`,
      );
    }
  }

  private async restoreForeignKeys(
    queryRunner: QueryRunner,
    foreignKeys: ForeignKey[],
  ): Promise<void> {
    for (const foreignKey of foreignKeys) {
      const columns = foreignKey.columns
        .sort((a, b) => a.ordinalPosition - b.ordinalPosition)
        .map((column) => this.quote(column.columnName))
        .join(', ');
      const referencedColumns = foreignKey.columns
        .sort((a, b) => a.ordinalPosition - b.ordinalPosition)
        .map((column) => this.quote(column.referencedColumnName))
        .join(', ');

      await queryRunner.query(
        `ALTER TABLE ${this.quote(foreignKey.tableName)}
         ADD CONSTRAINT ${this.quote(foreignKey.constraintName)}
         FOREIGN KEY (${columns})
         REFERENCES ${this.quote(foreignKey.referencedTableName)} (${referencedColumns})
         ON DELETE ${foreignKey.deleteRule} ON UPDATE ${foreignKey.updateRule}`,
      );
    }
  }

  private async assertFitsSignedInt(
    queryRunner: QueryRunner,
    foreignKeys: ForeignKey[],
  ): Promise<void> {
    const checked = new Set<string>();
    for (const foreignKey of foreignKeys) {
      for (const column of foreignKey.columns) {
        const key = `${column.tableName}.${column.columnName}`;
        if (checked.has(key)) continue;
        checked.add(key);
        const result = await queryRunner.query(
          `SELECT COUNT(*) AS invalidCount
           FROM ${this.quote(column.tableName)}
           WHERE ${this.quote(column.columnName)} < 0
              OR ${this.quote(column.columnName)} > 2147483647`,
        );
        if (Number(result[0]?.invalidCount ?? 0) > 0) {
          throw new Error(
            `Cannot downgrade ${column.tableName}.${column.columnName} to INT: value exceeds signed INT range.`,
          );
        }
      }
    }
  }

  private async isNullable(
    queryRunner: QueryRunner,
    tableName: string,
    columnName: string,
  ): Promise<boolean> {
    const rows = await queryRunner.query(
      `SELECT IS_NULLABLE AS nullable
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [tableName, columnName],
    );
    return rows[0]?.nullable === 'YES';
  }

  private async tableExists(
    queryRunner: QueryRunner,
    tableName: string,
  ): Promise<boolean> {
    const rows = await queryRunner.query(
      `SELECT COUNT(*) AS count
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [tableName],
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
