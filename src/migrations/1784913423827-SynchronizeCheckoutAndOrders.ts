import { MigrationInterface, QueryRunner } from 'typeorm';

/** Checkout/order schema migration. It intentionally fails before making an
 * existing order non-null if an old row cannot be snapshotted safely. */
export class SynchronizeCheckoutAndOrders1784913423827 implements MigrationInterface {
  name = 'SynchronizeCheckoutAndOrders1784913423827';

  private async columns(q: QueryRunner, table: string): Promise<Set<string>> {
    const rows = await q.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [table],
    );
    return new Set(rows.map((row: { COLUMN_NAME: string }) => row.COLUMN_NAME));
  }

  public async up(q: QueryRunner): Promise<void> {
    if (!(await q.hasTable('orders'))) throw new Error('orders table is required');

    let c = await this.columns(q, 'orders');
    const add = async (name: string, sql: string) => {
      if (!c.has(name)) { await q.query(`ALTER TABLE orders ADD COLUMN ${name} ${sql}`); c = await this.columns(q, 'orders'); }
    };

    await add('checkout_idempotency_key', `VARCHAR(150) NULL`);
    await add('checkout_request_hash', `VARCHAR(64) NULL`);
    await add('buyer_receiver_name', `VARCHAR(255) NULL`);
    await add('buyer_phone', `VARCHAR(30) NULL`);
    await add('buyer_full_address', `TEXT NULL`);
    await add('seller_full_address', `TEXT NULL`);
    await add('status_changed_at', `DATETIME(6) NULL`);
    await add('settlement_status', `VARCHAR(30) NULL`);
    await add('delivered_at', `DATETIME(6) NULL`);
    await add('return_deadline', `DATETIME(6) NULL`);
    await add('settled_at', `DATETIME(6) NULL`);
    await add('media_retention_until', `DATETIME(6) NULL`);
    await add('media_purged_at', `DATETIME(6) NULL`);

    await q.query(`
      UPDATE orders o
      LEFT JOIN addresses ba ON ba.id = o.buyer_address_id
      LEFT JOIN addresses sa ON sa.id = o.seller_address_id
      SET o.buyer_receiver_name = COALESCE(o.buyer_receiver_name, ba.receiver_name, ''),
          o.buyer_phone = COALESCE(o.buyer_phone, ba.phone, ''),
          o.buyer_full_address = COALESCE(o.buyer_full_address, ba.full_address, ba.address_detail, ''),
          o.seller_full_address = COALESCE(o.seller_full_address, sa.full_address, sa.address_detail, ''),
          o.status_changed_at = COALESCE(o.status_changed_at, o.created_at),
          o.checkout_idempotency_key = COALESCE(o.checkout_idempotency_key, CONCAT('LEGACY_CHECKOUT:', o.id)),
          o.checkout_request_hash = COALESCE(o.checkout_request_hash, SHA2(CONCAT('LEGACY_CHECKOUT:', o.id), 256)),
          o.settlement_status = COALESCE(o.settlement_status, 'holding')
    `);

    const missing = await q.query(`SELECT COUNT(*) count FROM orders WHERE checkout_idempotency_key IS NULL OR checkout_request_hash IS NULL OR buyer_receiver_name IS NULL OR buyer_phone IS NULL OR buyer_full_address IS NULL OR seller_full_address IS NULL OR status_changed_at IS NULL OR settlement_status IS NULL`);
    if (Number(missing[0]?.count || 0) > 0) throw new Error('Cannot snapshot legacy orders: an address or timestamp is missing.');
    const addressFks = await q.query(`SELECT DISTINCT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='orders' AND COLUMN_NAME IN ('buyer_address_id','seller_address_id') AND REFERENCED_TABLE_NAME IS NOT NULL`);
    for (const fk of addressFks) await q.query(`ALTER TABLE orders DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``);
    await q.query(`ALTER TABLE orders MODIFY checkout_idempotency_key VARCHAR(150) NOT NULL, MODIFY checkout_request_hash VARCHAR(64) NOT NULL, MODIFY buyer_address_id INT NOT NULL, MODIFY seller_address_id INT NOT NULL, MODIFY buyer_receiver_name VARCHAR(255) NOT NULL, MODIFY buyer_phone VARCHAR(30) NOT NULL, MODIFY buyer_full_address TEXT NOT NULL, MODIFY seller_full_address TEXT NOT NULL, MODIFY status_changed_at DATETIME(6) NOT NULL, MODIFY settlement_status ENUM('holding','refund_requested','released','refunded') NOT NULL DEFAULT 'holding', MODIFY total_price DECIMAL(20,3) NOT NULL DEFAULT '0.000', MODIFY shipping_fee DECIMAL(20,3) NOT NULL DEFAULT '0.000'`);

    // Normalize old status values before narrowing the enum.
    await q.query(`UPDATE orders SET status = 'pending_confirmation' WHERE status = 'pending'`);
    await q.query(`ALTER TABLE orders MODIFY status ENUM('pending_confirmation','confirmed','shipping','delivered','cancelled') NOT NULL DEFAULT 'pending_confirmation'`);
    const orderIndexes = await q.query(`SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders'`);
    const indexNames = new Set(orderIndexes.map((x: { INDEX_NAME: string }) => x.INDEX_NAME));
    if (!indexNames.has('uq_orders_buyer_checkout_idempotency')) await q.query(`CREATE UNIQUE INDEX uq_orders_buyer_checkout_idempotency ON orders (buyer_id, checkout_idempotency_key)`);
    if (!indexNames.has('idx_orders_settlement_release')) await q.query(`CREATE INDEX idx_orders_settlement_release ON orders (settlement_status, return_deadline)`);
    if (!indexNames.has('idx_orders_media_cleanup')) await q.query(`CREATE INDEX idx_orders_media_cleanup ON orders (media_purged_at, media_retention_until)`);
    if (!indexNames.has('idx_orders_buyer_status')) await q.query(`CREATE INDEX idx_orders_buyer_status ON orders (buyer_id, status, created_at, id)`);
    if (!indexNames.has('idx_orders_seller_status')) await q.query(`CREATE INDEX idx_orders_seller_status ON orders (seller_id, status, created_at, id)`);
    const orderChecks = await q.query(`SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='orders' AND CONSTRAINT_TYPE='CHECK'`);
    const checkNames = new Set(orderChecks.map((x: { CONSTRAINT_NAME: string }) => x.CONSTRAINT_NAME));
    if (!checkNames.has('chk_orders_buyer_not_seller')) await q.query(`ALTER TABLE orders ADD CONSTRAINT chk_orders_buyer_not_seller CHECK (buyer_id <> seller_id)`);
    if (!checkNames.has('chk_orders_total_price_non_negative')) await q.query(`ALTER TABLE orders ADD CONSTRAINT chk_orders_total_price_non_negative CHECK (total_price >= 0)`);
    if (!checkNames.has('chk_orders_shipping_fee_non_negative')) await q.query(`ALTER TABLE orders ADD CONSTRAINT chk_orders_shipping_fee_non_negative CHECK (shipping_fee >= 0)`);
    if (!checkNames.has('chk_orders_return_requires_delivery')) await q.query(`ALTER TABLE orders ADD CONSTRAINT chk_orders_return_requires_delivery CHECK (return_deadline IS NULL OR delivered_at IS NOT NULL)`);
    if (!checkNames.has('chk_orders_media_retention_requires_settlement')) await q.query(`ALTER TABLE orders ADD CONSTRAINT chk_orders_media_retention_requires_settlement CHECK (media_retention_until IS NULL OR settled_at IS NOT NULL)`);
    if (!checkNames.has('chk_orders_media_purge_requires_retention')) await q.query(`ALTER TABLE orders ADD CONSTRAINT chk_orders_media_purge_requires_retention CHECK (media_purged_at IS NULL OR media_retention_until IS NOT NULL)`);

    if (await q.hasTable('order_items')) {
      let i = await this.columns(q, 'order_items');
      const addItem = async (name: string, sql: string) => { if (!i.has(name)) { await q.query(`ALTER TABLE order_items ADD COLUMN ${name} ${sql}`); i = await this.columns(q, 'order_items'); } };
      await addItem('product_title_snapshot', 'VARCHAR(255) NULL');
      await addItem('product_image_snapshot_key', 'VARCHAR(512) NULL');
      await addItem('variant_snapshot', 'JSON NULL');
      await addItem('unit_list_price', 'DECIMAL(20,3) NULL');
      await addItem('unit_price', 'DECIMAL(20,3) NULL');
      await addItem('created_at', 'DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)');
      await q.query(`UPDATE order_items oi JOIN products p ON p.id = oi.product_id JOIN product_variants v ON v.id = oi.variant_id SET oi.product_title_snapshot = COALESCE(oi.product_title_snapshot,p.title,''), oi.product_image_snapshot_key = COALESCE(oi.product_image_snapshot_key, SUBSTRING_INDEX(p.image_urls, ',', 1)), oi.variant_snapshot = COALESCE(oi.variant_snapshot, JSON_OBJECT('size',v.size,'color',v.color,'weight',v.weight)), oi.unit_list_price = COALESCE(oi.unit_list_price,v.price), oi.unit_price = COALESCE(oi.unit_price,COALESCE(v.discount_price,v.price))`);
      const badItems = await q.query(`SELECT COUNT(*) count FROM order_items WHERE product_title_snapshot IS NULL OR variant_snapshot IS NULL OR unit_list_price IS NULL OR unit_price IS NULL OR quantity IS NULL OR total_price IS NULL`);
      if (Number(badItems[0]?.count || 0) > 0) throw new Error('Cannot snapshot legacy order items safely.');
      await q.query(`ALTER TABLE order_items MODIFY product_title_snapshot VARCHAR(255) NOT NULL, MODIFY variant_snapshot JSON NOT NULL, MODIFY unit_list_price DECIMAL(20,3) NOT NULL, MODIFY unit_price DECIMAL(20,3) NOT NULL, MODIFY quantity INT NOT NULL, MODIFY total_price DECIMAL(20,3) NOT NULL`);
      const itemIdx = await q.query(`SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='order_items'`);
      if (!itemIdx.some((x: { INDEX_NAME: string }) => x.INDEX_NAME === 'uq_order_items_order_variant')) await q.query(`CREATE UNIQUE INDEX uq_order_items_order_variant ON order_items (order_id, variant_id)`);
      const itemChecks = await q.query(`SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='order_items' AND CONSTRAINT_TYPE='CHECK'`);
      const itemCheckNames = new Set(itemChecks.map((x: { CONSTRAINT_NAME: string }) => x.CONSTRAINT_NAME));
      if (!itemCheckNames.has('chk_order_items_list_price_non_negative')) await q.query(`ALTER TABLE order_items ADD CONSTRAINT chk_order_items_list_price_non_negative CHECK (unit_list_price >= 0)`);
      if (!itemCheckNames.has('chk_order_items_unit_price_non_negative')) await q.query(`ALTER TABLE order_items ADD CONSTRAINT chk_order_items_unit_price_non_negative CHECK (unit_price >= 0)`);
      if (!itemCheckNames.has('chk_order_items_unit_price_not_above_list')) await q.query(`ALTER TABLE order_items ADD CONSTRAINT chk_order_items_unit_price_not_above_list CHECK (unit_price <= unit_list_price)`);
      if (!itemCheckNames.has('chk_order_items_quantity_positive')) await q.query(`ALTER TABLE order_items ADD CONSTRAINT chk_order_items_quantity_positive CHECK (quantity > 0)`);
      if (!itemCheckNames.has('chk_order_items_total_price')) await q.query(`ALTER TABLE order_items ADD CONSTRAINT chk_order_items_total_price CHECK (total_price = unit_price * quantity)`);
    }

    if (await q.hasTable('order_timelines')) {
      let t = await this.columns(q, 'order_timelines');
      if (t.has('status') && !t.has('new_status')) await q.query(`ALTER TABLE order_timelines ADD COLUMN new_status VARCHAR(30) NULL`);
      t = await this.columns(q, 'order_timelines');
      if (!t.has('previous_status')) await q.query(`ALTER TABLE order_timelines ADD COLUMN previous_status VARCHAR(30) NULL`);
      if (!t.has('change_source')) await q.query(`ALTER TABLE order_timelines ADD COLUMN change_source VARCHAR(20) NOT NULL DEFAULT 'system'`);
      if (!t.has('changed_by')) await q.query(`ALTER TABLE order_timelines ADD COLUMN changed_by INT NULL`);
      if (t.has('status')) await q.query(`UPDATE order_timelines SET new_status = CASE WHEN status='pending' THEN 'pending_confirmation' ELSE status END WHERE new_status IS NULL`);
      const badTimeline = await q.query(`SELECT COUNT(*) count FROM order_timelines WHERE new_status IS NULL`);
      if (Number(badTimeline[0]?.count || 0) > 0) throw new Error('Cannot migrate order timeline status.');
      await q.query(`ALTER TABLE order_timelines MODIFY previous_status ENUM('pending_confirmation','confirmed','shipping','delivered','cancelled') NULL, MODIFY new_status ENUM('pending_confirmation','confirmed','shipping','delivered','cancelled') NOT NULL, MODIFY change_source ENUM('buyer','seller','system','admin') NOT NULL DEFAULT 'system'`);
      if (t.has('status')) await q.query(`ALTER TABLE order_timelines DROP COLUMN status`);
    }

    if (await q.hasTable('shipping')) {
      const s = await this.columns(q, 'shipping');
      if (s.has('address_id')) {
        const oldFks = await q.query(`SELECT DISTINCT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shipping' AND COLUMN_NAME = 'address_id' AND REFERENCED_TABLE_NAME IS NOT NULL`);
        for (const fk of oldFks) await q.query(`ALTER TABLE shipping DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``);
        await q.query(`ALTER TABLE shipping DROP COLUMN address_id`);
      }
    }

    if (!(await q.hasTable('refunds'))) await q.query(`CREATE TABLE refunds (id BIGINT NOT NULL AUTO_INCREMENT, order_id INT NOT NULL, requested_by INT NOT NULL, amount DECIMAL(20,3) NOT NULL, reason TEXT NULL, status ENUM('requested','accepted','rejected','completed') NOT NULL DEFAULT 'requested', decision_source ENUM('seller','system_timeout') NULL, responded_by INT NULL, seller_response TEXT NULL, requested_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), seller_response_deadline DATETIME(6) NOT NULL, responded_at DATETIME(6) NULL, completed_at DATETIME(6) NULL, PRIMARY KEY(id), UNIQUE INDEX uq_refunds_order(order_id), INDEX idx_refunds_response_deadline(status,seller_response_deadline), CONSTRAINT chk_refunds_amount_positive CHECK (amount > 0), CONSTRAINT chk_refunds_response_deadline_after_request CHECK (seller_response_deadline > requested_at), CONSTRAINT chk_refunds_completed_has_timestamp CHECK (status <> 'completed' OR completed_at IS NOT NULL), CONSTRAINT fk_refunds_order FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE RESTRICT, CONSTRAINT fk_refunds_requested_by FOREIGN KEY(requested_by) REFERENCES users(id) ON DELETE RESTRICT, CONSTRAINT fk_refunds_responded_by FOREIGN KEY(responded_by) REFERENCES users(id) ON DELETE RESTRICT) ENGINE=InnoDB`);
  }

  public async down(q: QueryRunner): Promise<void> {
    if (await q.hasTable('refunds')) await q.query('DROP TABLE refunds');
  }
}
