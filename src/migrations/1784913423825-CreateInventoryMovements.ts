import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInventoryMovements1784913423825
  implements MigrationInterface
{
  name = 'CreateInventoryMovements1784913423825';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('inventory_movements');
    if (hasTable) return;

    await queryRunner.query(`
      CREATE TABLE inventory_movements (
        id BIGINT NOT NULL AUTO_INCREMENT,
        variant_id INT NOT NULL,
        order_item_id INT NULL,
        type ENUM(
          'initial_stock',
          'seller_adjustment',
          'order_deducted',
          'order_cancelled_restore',
          'return_restock'
        ) NOT NULL,
        quantity_delta INT NOT NULL,
        stock_before INT NOT NULL,
        stock_after INT NOT NULL,
        idempotency_key VARCHAR(150) NOT NULL,
        created_by INT NULL,
        reason TEXT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE INDEX UQ_inventory_movements_idempotency_key (idempotency_key),
        INDEX idx_inventory_movements_variant_history (variant_id, created_at, id),
        INDEX idx_inventory_movements_order_item (order_item_id, type),
        CONSTRAINT chk_inventory_movements_quantity_non_zero CHECK (quantity_delta <> 0),
        CONSTRAINT chk_inventory_movements_stock_before_non_negative CHECK (stock_before >= 0),
        CONSTRAINT chk_inventory_movements_stock_after_non_negative CHECK (stock_after >= 0),
        CONSTRAINT chk_inventory_movements_stock_equation CHECK (stock_after = stock_before + quantity_delta),
        CONSTRAINT fk_inventory_movements_variant
          FOREIGN KEY (variant_id) REFERENCES product_variants(id)
          ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT fk_inventory_movements_order_item
          FOREIGN KEY (order_item_id) REFERENCES order_items(id)
          ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT fk_inventory_movements_created_by
          FOREIGN KEY (created_by) REFERENCES users(id)
          ON DELETE RESTRICT ON UPDATE NO ACTION
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('inventory_movements')) {
      await queryRunner.query('DROP TABLE inventory_movements');
    }
  }
}
