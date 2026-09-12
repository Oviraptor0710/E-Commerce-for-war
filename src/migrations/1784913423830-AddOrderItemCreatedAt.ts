import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrderItemCreatedAt1784913423830 implements MigrationInterface {
  name = 'AddOrderItemCreatedAt1784913423830';

  public async up(q: QueryRunner): Promise<void> {
    const rows = await q.query(`SELECT COUNT(*) count FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_items' AND COLUMN_NAME='created_at'`);
    if (Number(rows[0]?.count || 0) === 0) await q.query(`ALTER TABLE order_items ADD COLUMN created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    const rows = await q.query(`SELECT COUNT(*) count FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_items' AND COLUMN_NAME='created_at'`);
    if (Number(rows[0]?.count || 0) > 0) await q.query(`ALTER TABLE order_items DROP COLUMN created_at`);
  }
}
