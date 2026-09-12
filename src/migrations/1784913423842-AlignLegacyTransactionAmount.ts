import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlignLegacyTransactionAmount1784913423842
  implements MigrationInterface
{
  name = 'AlignLegacyTransactionAmount1784913423842';

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

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await this.hasTable(queryRunner, 'transactions'))) return;

    await queryRunner.query(
      'ALTER TABLE `transactions` MODIFY COLUMN `amount` DECIMAL(20,3) NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await this.hasTable(queryRunner, 'transactions'))) return;

    await queryRunner.query(
      'ALTER TABLE `transactions` MODIFY COLUMN `amount` DECIMAL(10,0) NULL',
    );
  }
}
