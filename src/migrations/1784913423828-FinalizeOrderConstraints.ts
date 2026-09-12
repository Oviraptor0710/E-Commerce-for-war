import { MigrationInterface, QueryRunner } from 'typeorm';

export class FinalizeOrderConstraints1784913423828 implements MigrationInterface {
  name = 'FinalizeOrderConstraints1784913423828';

  public async up(q: QueryRunner): Promise<void> {
    const checks = async (table: string) => {
      const rows = await q.query(`SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND CONSTRAINT_TYPE='CHECK'`, [table]);
      return new Set(rows.map((r: { CONSTRAINT_NAME: string }) => r.CONSTRAINT_NAME));
    };
    let orderChecks = await checks('orders');
    const addOrderCheck = async (name: string, expression: string) => { if (!orderChecks.has(name)) { await q.query(`ALTER TABLE orders ADD CONSTRAINT ${name} CHECK (${expression})`); orderChecks = await checks('orders'); } };
    await addOrderCheck('chk_orders_buyer_not_seller', 'buyer_id <> seller_id');
    await addOrderCheck('chk_orders_total_price_non_negative', 'total_price >= 0');
    await addOrderCheck('chk_orders_shipping_fee_non_negative', 'shipping_fee >= 0');
    await addOrderCheck('chk_orders_return_requires_delivery', 'return_deadline IS NULL OR delivered_at IS NOT NULL');
    await addOrderCheck('chk_orders_media_retention_requires_settlement', 'media_retention_until IS NULL OR settled_at IS NOT NULL');
    await addOrderCheck('chk_orders_media_purge_requires_retention', 'media_purged_at IS NULL OR media_retention_until IS NOT NULL');

    let itemChecks = await checks('order_items');
    const addItemCheck = async (name: string, expression: string) => { if (!itemChecks.has(name)) { await q.query(`ALTER TABLE order_items ADD CONSTRAINT ${name} CHECK (${expression})`); itemChecks = await checks('order_items'); } };
    await addItemCheck('chk_order_items_list_price_non_negative', 'unit_list_price >= 0');
    await addItemCheck('chk_order_items_unit_price_non_negative', 'unit_price >= 0');
    await addItemCheck('chk_order_items_unit_price_not_above_list', 'unit_price <= unit_list_price');
    await addItemCheck('chk_order_items_quantity_positive', 'quantity > 0');
    await addItemCheck('chk_order_items_total_price', 'total_price = unit_price * quantity');

    const oldColumn = await q.query(`SELECT COUNT(*) count FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='orders' AND COLUMN_NAME='status_id'`);
    if (Number(oldColumn[0]?.count || 0) > 0) {
      const fks = await q.query(`SELECT DISTINCT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='orders' AND COLUMN_NAME='status_id' AND REFERENCED_TABLE_NAME IS NOT NULL`);
      for (const fk of fks) await q.query(`ALTER TABLE orders DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``);
      await q.query('ALTER TABLE orders DROP COLUMN status_id');
    }
  }

  public async down(): Promise<void> {
    // Constraints are intentionally retained on rollback; removing safety checks is unsafe.
  }
}
