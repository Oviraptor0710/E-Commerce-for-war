import { MigrationInterface, QueryRunner } from 'typeorm';

type ColumnDefinition = {
  table: string;
  column: string;
  nullable: boolean;
  autoIncrement?: boolean;
};

type ForeignKeyDefinition = {
  name: string;
  table: string;
  column: string;
  referencedTable: string;
  referencedColumn: string;
  onDelete?: 'CASCADE' | 'RESTRICT' | 'NO ACTION';
};

const columns: ColumnDefinition[] = [
  { table: 'wallets', column: 'id', nullable: false, autoIncrement: true },
  { table: 'wallet_entries', column: 'wallet_id', nullable: false },
  { table: 'transactions', column: 'id', nullable: false, autoIncrement: true },
  { table: 'transactions', column: 'wallet_id', nullable: false },
  { table: 'reward_rules', column: 'id', nullable: false, autoIncrement: true },
  { table: 'reward_proofs', column: 'id', nullable: false, autoIncrement: true },
  { table: 'reward_appeals', column: 'id', nullable: false, autoIncrement: true },
  { table: 'reward_appeals', column: 'proof_id', nullable: true },
  { table: 'user_codes', column: 'id', nullable: false, autoIncrement: true },
  { table: 'user_follows', column: 'id', nullable: false, autoIncrement: true },
  { table: 'user_blocks', column: 'id', nullable: false, autoIncrement: true },
  { table: 'push_settings', column: 'id', nullable: false, autoIncrement: true },
  { table: 'news', column: 'id', nullable: false, autoIncrement: true },
  { table: 'dev_tokens', column: 'id', nullable: false, autoIncrement: true },
  { table: 'comments', column: 'id', nullable: false, autoIncrement: true },
  { table: 'likes', column: 'id', nullable: false, autoIncrement: true },
  { table: 'rates', column: 'id', nullable: false, autoIncrement: true },
  { table: 'reports', column: 'id', nullable: false, autoIncrement: true },
  { table: 'saved_searches', column: 'id', nullable: false, autoIncrement: true },
];

const foreignKeys: ForeignKeyDefinition[] = [
  {
    name: 'fk_wallet_entries_wallet',
    table: 'wallet_entries',
    column: 'wallet_id',
    referencedTable: 'wallets',
    referencedColumn: 'id',
    onDelete: 'RESTRICT',
  },
  {
    name: 'fk_transactions_wallet',
    table: 'transactions',
    column: 'wallet_id',
    referencedTable: 'wallets',
    referencedColumn: 'id',
  },
  {
    name: 'fk_reward_appeals_proof',
    table: 'reward_appeals',
    column: 'proof_id',
    referencedTable: 'reward_proofs',
    referencedColumn: 'id',
  },
];

export class ConvertWalletAndAuxiliaryIdsToBigint1784913423841
  implements MigrationInterface
{
  name = 'ConvertWalletAndAuxiliaryIdsToBigint1784913423841';

  private async hasTable(
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

  private async hasColumn(
    queryRunner: QueryRunner,
    tableName: string,
    columnName: string,
  ): Promise<boolean> {
    const rows = await queryRunner.query(
      `SELECT COUNT(*) AS count
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?
         AND COLUMN_NAME = ?`,
      [tableName, columnName],
    );
    return Number(rows[0]?.count ?? 0) > 0;
  }

  private async hasConstraint(
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

  private async dropAffectedForeignKeys(queryRunner: QueryRunner): Promise<void> {
    const affectedColumns = new Set([
      'wallets.id',
      'wallet_entries.wallet_id',
      'transactions.id',
      'transactions.wallet_id',
      'reward_proofs.id',
      'reward_appeals.id',
      'reward_appeals.proof_id',
    ]);
    const rows = await queryRunner.query(
      `SELECT DISTINCT
          k.TABLE_NAME,
          k.COLUMN_NAME,
          k.CONSTRAINT_NAME,
          k.REFERENCED_TABLE_NAME,
          k.REFERENCED_COLUMN_NAME
       FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE k
       WHERE k.CONSTRAINT_SCHEMA = DATABASE()
         AND k.REFERENCED_TABLE_NAME IS NOT NULL`,
    );

    for (const row of rows as Array<{
      TABLE_NAME: string;
      COLUMN_NAME: string;
      CONSTRAINT_NAME: string;
      REFERENCED_TABLE_NAME: string;
      REFERENCED_COLUMN_NAME: string;
    }>) {
      const local = `${row.TABLE_NAME}.${row.COLUMN_NAME}`.toLowerCase();
      const referenced = `${row.REFERENCED_TABLE_NAME}.${row.REFERENCED_COLUMN_NAME}`.toLowerCase();
      if (
        !affectedColumns.has(local) &&
        !affectedColumns.has(referenced)
      ) {
        continue;
      }

      await queryRunner.query(
        `ALTER TABLE \`${row.TABLE_NAME.replace(/`/g, '``')}\`
         DROP FOREIGN KEY \`${row.CONSTRAINT_NAME.replace(/`/g, '``')}\``,
      );
    }
  }

  private async modifyColumns(
    queryRunner: QueryRunner,
    type: 'BIGINT' | 'INT',
  ): Promise<void> {
    for (const column of columns) {
      if (!(await this.hasTable(queryRunner, column.table))) continue;
      if (!(await this.hasColumn(queryRunner, column.table, column.column))) {
        continue;
      }

      const nullable = column.nullable ? 'NULL' : 'NOT NULL';
      const autoIncrement = column.autoIncrement ? ' AUTO_INCREMENT' : '';
      await queryRunner.query(
        `ALTER TABLE \`${column.table}\`
         MODIFY COLUMN \`${column.column}\` ${type} ${nullable}${autoIncrement}`,
      );
    }
  }

  private async applyForeignKeys(queryRunner: QueryRunner): Promise<void> {
    for (const foreignKey of foreignKeys) {
      if (!(await this.hasTable(queryRunner, foreignKey.table))) continue;
      if (!(await this.hasColumn(queryRunner, foreignKey.table, foreignKey.column))) {
        continue;
      }
      if (!(await this.hasTable(queryRunner, foreignKey.referencedTable))) {
        continue;
      }
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
    await this.dropAffectedForeignKeys(queryRunner);
    await this.modifyColumns(queryRunner, 'BIGINT');
    await this.applyForeignKeys(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.dropAffectedForeignKeys(queryRunner);
    await this.modifyColumns(queryRunner, 'INT');
    await this.applyForeignKeys(queryRunner);
  }
}
