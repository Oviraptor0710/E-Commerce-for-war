import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Removes the old order-status and warehouse tables.
 *
 * Order status is now stored in orders.status and its history in
 * order_timelines. A seller's shipping location is an addresses row, so a
 * separate Warehouses table is no longer part of the domain model.
 */
export class CleanupLegacyOrderSchema1784913423837
  implements MigrationInterface
{
  name = 'CleanupLegacyOrderSchema1784913423837';

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

  private async columnExists(
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

  private async dropForeignKeysForColumn(
    queryRunner: QueryRunner,
    tableName: string,
    columnName: string,
  ): Promise<void> {
    const foreignKeys = await queryRunner.query(
      `SELECT DISTINCT CONSTRAINT_NAME
       FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?
         AND COLUMN_NAME = ?
         AND REFERENCED_TABLE_NAME IS NOT NULL`,
      [tableName, columnName],
    );

    for (const foreignKey of foreignKeys as Array<{
      CONSTRAINT_NAME: string;
    }>) {
      const constraintName = foreignKey.CONSTRAINT_NAME.replace(/`/g, '``');
      await queryRunner.query(
        `ALTER TABLE \`${tableName}\` DROP FOREIGN KEY \`${constraintName}\``,
      );
    }
  }

  private async dropEmptyLegacyTable(
    queryRunner: QueryRunner,
    tableName: string,
  ): Promise<void> {
    if (!(await this.tableExists(queryRunner, tableName))) return;

    const rows = await queryRunner.query(
      `SELECT COUNT(*) AS count FROM \`${tableName}\``,
    );
    const rowCount = Number(rows[0]?.count ?? 0);
    if (rowCount > 0) {
      throw new Error(
        `Cannot remove legacy table ${tableName}: it contains ${rowCount} row(s). Migrate or archive the data first.`,
      );
    }

    const foreignKeys = await queryRunner.query(
      `SELECT DISTINCT CONSTRAINT_NAME
       FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?
         AND REFERENCED_TABLE_NAME IS NOT NULL`,
      [tableName],
    );
    for (const foreignKey of foreignKeys as Array<{
      CONSTRAINT_NAME: string;
    }>) {
      const constraintName = foreignKey.CONSTRAINT_NAME.replace(/`/g, '``');
      await queryRunner.query(
        `ALTER TABLE \`${tableName}\` DROP FOREIGN KEY \`${constraintName}\``,
      );
    }

    await queryRunner.query(`DROP TABLE \`${tableName}\``);
  }

  private async hasProvinceForeignKey(
    queryRunner: QueryRunner,
  ): Promise<boolean> {
    const rows = await queryRunner.query(
      `SELECT COUNT(*) AS count
       FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'Wards'
         AND COLUMN_NAME = 'province_id'
         AND REFERENCED_TABLE_NAME = 'Provinces'
         AND REFERENCED_COLUMN_NAME = 'id'`,
    );
    return Number(rows[0]?.count ?? 0) > 0;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.dropEmptyLegacyTable(queryRunner, 'Status');
    await this.dropEmptyLegacyTable(queryRunner, 'Warehouses');

    if (!(await this.tableExists(queryRunner, 'Wards'))) return;

    const hasOldName = await this.columnExists(
      queryRunner,
      'Wards',
      'provinces_id',
    );
    const hasNewName = await this.columnExists(
      queryRunner,
      'Wards',
      'province_id',
    );

    if (hasOldName && hasNewName) {
      throw new Error(
        'Wards contains both provinces_id and province_id; resolve the duplicate columns before migrating.',
      );
    }

    if (hasOldName) {
      await this.dropForeignKeysForColumn(
        queryRunner,
        'Wards',
        'provinces_id',
      );
      await queryRunner.query(
        'ALTER TABLE `Wards` CHANGE COLUMN `provinces_id` `province_id` INT NOT NULL',
      );
    }

    if ((hasOldName || hasNewName) && !(await this.hasProvinceForeignKey(queryRunner))) {
      await queryRunner.query(
        'ALTER TABLE `Wards` ADD CONSTRAINT `fk_wards_province` FOREIGN KEY (`province_id`) REFERENCES `Provinces` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await this.tableExists(queryRunner, 'Wards')) {
      const hasOldName = await this.columnExists(
        queryRunner,
        'Wards',
        'provinces_id',
      );
      const hasNewName = await this.columnExists(
        queryRunner,
        'Wards',
        'province_id',
      );

      if (hasNewName && !hasOldName) {
        await this.dropForeignKeysForColumn(
          queryRunner,
          'Wards',
          'province_id',
        );
        await queryRunner.query(
          'ALTER TABLE `Wards` CHANGE COLUMN `province_id` `provinces_id` INT NOT NULL',
        );
        await queryRunner.query(
          'ALTER TABLE `Wards` ADD CONSTRAINT `FK_47267a6978e1d13f2e9375df8e4` FOREIGN KEY (`provinces_id`) REFERENCES `Provinces` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE',
        );
      }
    }
  }
}
