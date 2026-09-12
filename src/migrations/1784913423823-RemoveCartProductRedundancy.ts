import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveCartProductRedundancy1784913423823
  implements MigrationInterface
{
  name = 'RemoveCartProductRedundancy1784913423823';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasProductId = await queryRunner.hasColumn('cart_items', 'product_id');
    if (!hasProductId) return;

    await queryRunner.query(`
      ALTER TABLE cart_items
        DROP FOREIGN KEY FK_30e89257a105eab7648a35c7fce,
        DROP COLUMN product_id
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasProductId = await queryRunner.hasColumn('cart_items', 'product_id');
    if (hasProductId) return;

    await queryRunner.query(`
      ALTER TABLE cart_items ADD COLUMN product_id INT NULL
    `);
    await queryRunner.query(`
      UPDATE cart_items ci
      INNER JOIN product_variants pv ON pv.id = ci.variant_id
      SET ci.product_id = pv.product_id
    `);
    await queryRunner.query(`
      ALTER TABLE cart_items
        MODIFY COLUMN product_id INT NOT NULL,
        ADD CONSTRAINT FK_30e89257a105eab7648a35c7fce
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
  }
}
