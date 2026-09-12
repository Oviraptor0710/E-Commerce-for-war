import { MigrationInterface, QueryRunner } from 'typeorm';

export class SynchronizeProductsAndVariants1784913423822
  implements MigrationInterface
{
  name = 'SynchronizeProductsAndVariants1784913423822';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const invalidProducts = await queryRunner.query(`
      SELECT COUNT(*) AS count
      FROM products p
      WHERE p.price IS NULL
         OR p.price < 0
         OR NOT EXISTS (
           SELECT 1
           FROM product_variants pv
           WHERE pv.product_id = p.id
             AND pv.deleted_at IS NULL
         )
    `);

    if (Number(invalidProducts[0]?.count || 0) > 0) {
      throw new Error(
        'Cannot synchronize products: every existing product must have a non-negative price and at least one active variant.',
      );
    }

    const ambiguousCartItems = await queryRunner.query(`
      SELECT COUNT(*) AS count
      FROM (
        SELECT ci.id
        FROM cart_items ci
        LEFT JOIN product_variants pv
          ON pv.product_id = ci.product_id
         AND pv.deleted_at IS NULL
        GROUP BY ci.id
        HAVING COUNT(pv.id) <> 1
      ) invalid_cart_items
    `);

    if (Number(ambiguousCartItems[0]?.count || 0) > 0) {
      throw new Error(
        'Cannot synchronize cart_items: an existing cart item must map to exactly one active product variant.',
      );
    }

    const legacyOrderItems = await queryRunner.query(`
      SELECT COUNT(*) AS count
      FROM order_items
      WHERE variant_id IS NULL
    `);

    if (Number(legacyOrderItems[0]?.count || 0) > 0) {
      throw new Error(
        'Cannot synchronize order_items: existing order items without variant_id require a business-specific backfill.',
      );
    }

    if (!(await queryRunner.hasColumn('products', 'min_price'))) {
      await queryRunner.query(`
        ALTER TABLE products
          ADD COLUMN min_price DECIMAL(20,3) NULL,
          ADD COLUMN max_price DECIMAL(20,3) NULL
      `);
    }
    if (!(await queryRunner.hasColumn('product_variants', 'price'))) {
      await queryRunner.query(`
        ALTER TABLE product_variants
          ADD COLUMN price DECIMAL(20,3) NULL,
          ADD COLUMN discount_price DECIMAL(20,3) NULL
      `);
    }
    if (!(await queryRunner.hasColumn('cart_items', 'variant_id'))) {
      await queryRunner.query(`
        ALTER TABLE cart_items ADD COLUMN variant_id INT NULL
      `);
    }

    await queryRunner.query(`
      UPDATE product_variants pv
      INNER JOIN products p ON p.id = pv.product_id
      SET pv.price = COALESCE(p.price, 0),
          pv.discount_price = CASE
            WHEN p.price_discount IS NOT NULL
             AND p.price_discount >= 0
             AND p.price_discount <= p.price
            THEN p.price_discount
            ELSE NULL
          END,
          pv.stock = COALESCE(pv.stock, 0)
    `);

    await queryRunner.query(`
      UPDATE products p
      INNER JOIN (
        SELECT
          pv.product_id,
          MIN(COALESCE(pv.discount_price, pv.price)) AS min_price,
          MAX(COALESCE(pv.discount_price, pv.price)) AS max_price
        FROM product_variants pv
        WHERE pv.deleted_at IS NULL
        GROUP BY pv.product_id
      ) price_range ON price_range.product_id = p.id
      SET p.min_price = price_range.min_price,
          p.max_price = price_range.max_price
    `);

    await queryRunner.query(`
      UPDATE cart_items ci
      INNER JOIN product_variants pv
        ON pv.product_id = ci.product_id
       AND pv.deleted_at IS NULL
      SET ci.variant_id = pv.id
    `);

    await queryRunner.query(`
      ALTER TABLE products
        MODIFY COLUMN min_price DECIMAL(20,3) NOT NULL,
        MODIFY COLUMN max_price DECIMAL(20,3) NOT NULL,
        DROP COLUMN price,
        DROP COLUMN price_discount
    `);
    await queryRunner.query(`
      ALTER TABLE product_variants
        MODIFY COLUMN price DECIMAL(20,3) NOT NULL,
        MODIFY COLUMN stock INT NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE cart_items
        MODIFY COLUMN variant_id INT NOT NULL,
        DROP INDEX IDX_b2c6ebe6bd6f9a4e6bbd8ab082,
        ADD UNIQUE INDEX UQ_cart_items_user_variant (user_id, variant_id)
    `);
    await queryRunner.query(`
      ALTER TABLE order_items
        MODIFY COLUMN variant_id INT NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE products
        ADD CONSTRAINT chk_products_min_price_non_negative CHECK (min_price >= 0),
        ADD CONSTRAINT chk_products_price_range CHECK (max_price >= min_price),
        ADD INDEX idx_products_category_active (category_id, deleted_at),
        ADD INDEX idx_products_brand_active (brand_id, deleted_at),
        ADD INDEX idx_products_min_price (min_price),
        ADD INDEX idx_products_max_price (max_price)
    `);
    await queryRunner.query(`
      ALTER TABLE product_variants
        ADD CONSTRAINT chk_product_variants_price_non_negative CHECK (price >= 0),
        ADD CONSTRAINT chk_product_variants_discount_non_negative CHECK (discount_price IS NULL OR discount_price >= 0),
        ADD CONSTRAINT chk_product_variants_discount_not_above_price CHECK (discount_price IS NULL OR discount_price <= price),
        ADD CONSTRAINT chk_product_variants_stock_non_negative CHECK (stock >= 0),
        ADD CONSTRAINT chk_product_variants_weight_non_negative CHECK (weight IS NULL OR weight >= 0),
        ADD INDEX idx_product_variants_product_active (product_id, deleted_at)
    `);
    await queryRunner.query(`
      ALTER TABLE cart_items
        ADD CONSTRAINT fk_cart_items_variant
        FOREIGN KEY (variant_id) REFERENCES product_variants(id)
        ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE cart_items
        DROP FOREIGN KEY fk_cart_items_variant,
        DROP INDEX UQ_cart_items_user_variant,
        DROP COLUMN variant_id,
        ADD UNIQUE INDEX IDX_b2c6ebe6bd6f9a4e6bbd8ab082 (user_id, product_id)
    `);
    await queryRunner.query(`ALTER TABLE order_items MODIFY COLUMN variant_id INT NULL`);
    await queryRunner.query(`
      ALTER TABLE products
        DROP CHECK chk_products_min_price_non_negative,
        DROP CHECK chk_products_price_range,
        DROP INDEX idx_products_category_active,
        DROP INDEX idx_products_brand_active,
        DROP INDEX idx_products_min_price,
        DROP INDEX idx_products_max_price,
        ADD COLUMN price DECIMAL NULL,
        ADD COLUMN price_discount DECIMAL NULL
    `);
    await queryRunner.query(`
      UPDATE products
      SET price = min_price,
          price_discount = NULL
    `);
    await queryRunner.query(`
      ALTER TABLE product_variants
        DROP CHECK chk_product_variants_price_non_negative,
        DROP CHECK chk_product_variants_discount_non_negative,
        DROP CHECK chk_product_variants_discount_not_above_price,
        DROP CHECK chk_product_variants_stock_non_negative,
        DROP CHECK chk_product_variants_weight_non_negative,
        DROP INDEX idx_product_variants_product_active,
        DROP COLUMN price,
        DROP COLUMN discount_price
    `);
    await queryRunner.query(`
      ALTER TABLE products
        DROP COLUMN min_price,
        DROP COLUMN max_price
    `);
  }
}
