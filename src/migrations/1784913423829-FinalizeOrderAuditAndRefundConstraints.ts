import { MigrationInterface, QueryRunner } from 'typeorm';

export class FinalizeOrderAuditAndRefundConstraints1784913423829 implements MigrationInterface {
  name = 'FinalizeOrderAuditAndRefundConstraints1784913423829';

  public async up(q: QueryRunner): Promise<void> {
    if (await q.hasTable('order_timelines')) {
      const columns = await q.query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_timelines'`);
      if (columns.some((r: { COLUMN_NAME: string }) => r.COLUMN_NAME === 'id')) await q.query(`ALTER TABLE order_timelines MODIFY id BIGINT NOT NULL AUTO_INCREMENT`);
      const indexes = await q.query(`SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_timelines'`);
      if (!indexes.some((r: { INDEX_NAME: string }) => r.INDEX_NAME === 'idx_order_timelines_history')) await q.query(`CREATE INDEX idx_order_timelines_history ON order_timelines (order_id, created_at, id)`);
    }
    if (await q.hasTable('refunds')) {
      const rows = await q.query(`SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='refunds' AND CONSTRAINT_TYPE='CHECK'`);
      const names = new Set(rows.map((r: { CONSTRAINT_NAME: string }) => r.CONSTRAINT_NAME));
      if (!names.has('chk_refunds_responded_after_request')) await q.query(`ALTER TABLE refunds ADD CONSTRAINT chk_refunds_responded_after_request CHECK (responded_at IS NULL OR responded_at >= requested_at)`);
      if (!names.has('chk_refunds_completed_after_request')) await q.query(`ALTER TABLE refunds ADD CONSTRAINT chk_refunds_completed_after_request CHECK (completed_at IS NULL OR completed_at >= requested_at)`);
      if (!names.has('chk_refunds_seller_has_responder')) await q.query(`ALTER TABLE refunds ADD CONSTRAINT chk_refunds_seller_has_responder CHECK (decision_source <> 'seller' OR responded_by IS NOT NULL)`);
      if (!names.has('chk_refunds_timeout_has_no_responder')) await q.query(`ALTER TABLE refunds ADD CONSTRAINT chk_refunds_timeout_has_no_responder CHECK (decision_source <> 'system_timeout' OR responded_by IS NULL)`);
    }
  }

  public async down(): Promise<void> {
    // Keep audit and refund integrity constraints on rollback.
  }
}
