import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeOrderAddressesRequired1784913423831 implements MigrationInterface {
  name = 'MakeOrderAddressesRequired1784913423831';

  public async up(q: QueryRunner): Promise<void> {
    const rows = await q.query(`SELECT COUNT(*) count FROM orders WHERE buyer_address_id IS NULL OR seller_address_id IS NULL`);
    if (Number(rows[0]?.count || 0) > 0) throw new Error('Cannot make order address references required: legacy order has no address.');
    const fks = await q.query(`SELECT DISTINCT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='orders' AND COLUMN_NAME IN ('buyer_address_id','seller_address_id') AND REFERENCED_TABLE_NAME IS NOT NULL`);
    for (const fk of fks) await q.query(`ALTER TABLE orders DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``);
    await q.query(`ALTER TABLE orders MODIFY buyer_address_id INT NOT NULL, MODIFY seller_address_id INT NOT NULL`);
    await q.query(`ALTER TABLE orders ADD CONSTRAINT fk_orders_buyer_address FOREIGN KEY (buyer_address_id) REFERENCES addresses(id) ON DELETE RESTRICT ON UPDATE NO ACTION, ADD CONSTRAINT fk_orders_seller_address FOREIGN KEY (seller_address_id) REFERENCES addresses(id) ON DELETE RESTRICT ON UPDATE NO ACTION`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE orders MODIFY buyer_address_id INT NULL, MODIFY seller_address_id INT NULL`);
  }
}
