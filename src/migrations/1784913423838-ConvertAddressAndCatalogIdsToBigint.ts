import { MigrationInterface, QueryRunner } from 'typeorm';

type ForeignKeyDefinition = {
  name: string;
  table: string;
  column: string;
  referencedTable: string;
  referencedColumn: string;
  onDelete?: 'RESTRICT' | 'SET NULL' | 'NO ACTION';
  onUpdate?: 'CASCADE' | 'NO ACTION';
};

const foreignKeys: ForeignKeyDefinition[] = [
  {
    name: 'fk_wards_province',
    table: 'Wards',
    column: 'province_id',
    referencedTable: 'Provinces',
    referencedColumn: 'id',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  },
  {
    name: 'fk_addresses_ward',
    table: 'addresses',
    column: 'ward_id',
    referencedTable: 'Wards',
    referencedColumn: 'id',
  },
  {
    name: 'fk_seller_applications_ship_from',
    table: 'seller_applications',
    column: 'ship_from_address_id',
    referencedTable: 'addresses',
    referencedColumn: 'id',
    onDelete: 'RESTRICT',
  },
  {
    name: 'fk_seller_profiles_default_ship_from',
    table: 'seller_profiles',
    column: 'default_ship_from_address_id',
    referencedTable: 'addresses',
    referencedColumn: 'id',
    onDelete: 'RESTRICT',
  },
  {
    name: 'fk_orders_buyer_address',
    table: 'orders',
    column: 'buyer_address_id',
    referencedTable: 'addresses',
    referencedColumn: 'id',
  },
  {
    name: 'fk_orders_seller_address',
    table: 'orders',
    column: 'seller_address_id',
    referencedTable: 'addresses',
    referencedColumn: 'id',
  },
  {
    name: 'fk_products_ship_from',
    table: 'products',
    column: 'ship_from_id',
    referencedTable: 'addresses',
    referencedColumn: 'id',
  },
  {
    name: 'fk_categories_parent',
    table: 'categories',
    column: 'parent_id',
    referencedTable: 'categories',
    referencedColumn: 'id',
    onDelete: 'SET NULL',
  },
  {
    name: 'fk_brands_category',
    table: 'brands',
    column: 'category_id',
    referencedTable: 'categories',
    referencedColumn: 'id',
    onDelete: 'SET NULL',
  },
  {
    name: 'fk_products_category',
    table: 'products',
    column: 'category_id',
    referencedTable: 'categories',
    referencedColumn: 'id',
  },
  {
    name: 'fk_products_brand',
    table: 'products',
    column: 'brand_id',
    referencedTable: 'brands',
    referencedColumn: 'id',
  },
  {
    name: 'fk_product_variants_product',
    table: 'product_variants',
    column: 'product_id',
    referencedTable: 'products',
    referencedColumn: 'id',
  },
  {
    name: 'fk_comments_product',
    table: 'comments',
    column: 'product_id',
    referencedTable: 'products',
    referencedColumn: 'id',
  },
  {
    name: 'fk_likes_product',
    table: 'likes',
    column: 'product_id',
    referencedTable: 'products',
    referencedColumn: 'id',
  },
  {
    name: 'fk_rates_product',
    table: 'rates',
    column: 'product_id',
    referencedTable: 'products',
    referencedColumn: 'id',
    onDelete: 'RESTRICT',
  },
  {
    name: 'fk_reports_product',
    table: 'reports',
    column: 'product_id',
    referencedTable: 'products',
    referencedColumn: 'id',
  },
  {
    name: 'fk_cart_items_variant',
    table: 'cart_items',
    column: 'variant_id',
    referencedTable: 'product_variants',
    referencedColumn: 'id',
    onDelete: 'RESTRICT',
  },
  {
    name: 'fk_order_items_product',
    table: 'order_items',
    column: 'product_id',
    referencedTable: 'products',
    referencedColumn: 'id',
    onDelete: 'RESTRICT',
  },
  {
    name: 'fk_order_items_variant',
    table: 'order_items',
    column: 'variant_id',
    referencedTable: 'product_variants',
    referencedColumn: 'id',
    onDelete: 'RESTRICT',
  },
  {
    name: 'fk_inventory_movements_variant',
    table: 'inventory_movements',
    column: 'variant_id',
    referencedTable: 'product_variants',
    referencedColumn: 'id',
    onDelete: 'RESTRICT',
  },
  {
    name: 'fk_inventory_movements_order_item',
    table: 'inventory_movements',
    column: 'order_item_id',
    referencedTable: 'order_items',
    referencedColumn: 'id',
    onDelete: 'RESTRICT',
  },
];

const primaryKeys: Array<{ table: string; column: string }> = [
  { table: 'Provinces', column: 'id' },
  { table: 'Wards', column: 'id' },
  { table: 'addresses', column: 'id' },
  { table: 'categories', column: 'id' },
  { table: 'brands', column: 'id' },
  { table: 'products', column: 'id' },
  { table: 'product_variants', column: 'id' },
  { table: 'cart_items', column: 'id' },
  { table: 'order_items', column: 'id' },
];

const bigintColumns = [
  ...primaryKeys.map(({ table, column }) => ({
    table,
    column,
    nullable: false,
  })),
  ...[
    ['Wards', 'province_id', false],
    ['addresses', 'ward_id', false],
    ['seller_applications', 'ship_from_address_id', false],
    ['seller_profiles', 'default_ship_from_address_id', false],
    ['orders', 'buyer_address_id', false],
    ['orders', 'seller_address_id', false],
    ['products', 'ship_from_id', false],
    ['products', 'category_id', false],
    ['products', 'brand_id', true],
    ['categories', 'parent_id', true],
    ['brands', 'category_id', true],
    ['product_variants', 'product_id', false],
    ['comments', 'product_id', false],
    ['likes', 'product_id', false],
    ['rates', 'product_id', true],
    ['reports', 'product_id', false],
    ['cart_items', 'variant_id', false],
    ['order_items', 'product_id', false],
    ['order_items', 'variant_id', false],
    ['inventory_movements', 'variant_id', false],
    ['inventory_movements', 'order_item_id', true],
  ].map(([table, column, nullable]) => ({
    table: table as string,
    column: column as string,
    nullable: nullable as boolean,
  })),
];

export class ConvertAddressAndCatalogIdsToBigint1784913423838
  implements MigrationInterface
{
  name = 'ConvertAddressAndCatalogIdsToBigint1784913423838';

  private async dropForeignKeys(queryRunner: QueryRunner): Promise<void> {
    const columns = new Set(
      foreignKeys.map((foreignKey) => `${foreignKey.table}.${foreignKey.column}`),
    );
    const rows = await queryRunner.query(
      `SELECT DISTINCT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME
       FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE()
         AND REFERENCED_TABLE_NAME IS NOT NULL`,
    );

    for (const row of rows as Array<{
      TABLE_NAME: string;
      COLUMN_NAME: string;
      CONSTRAINT_NAME: string;
    }>) {
      if (!columns.has(`${row.TABLE_NAME}.${row.COLUMN_NAME}`)) continue;
      const table = row.TABLE_NAME.replace(/`/g, '``');
      const constraint = row.CONSTRAINT_NAME.replace(/`/g, '``');
      await queryRunner.query(
        `ALTER TABLE \`${table}\` DROP FOREIGN KEY \`${constraint}\``,
      );
    }
  }

  private async hasTable(
    queryRunner: QueryRunner,
    tableName: string,
  ): Promise<boolean> {
    const rows = await queryRunner.query(
      `SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [tableName],
    );
    return Number(rows[0]?.count ?? 0) > 0;
  }

  private async hasConstraint(
    queryRunner: QueryRunner,
    constraintName: string,
  ): Promise<boolean> {
    const rows = await queryRunner.query(
      `SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
       WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = ?`,
      [constraintName],
    );
    return Number(rows[0]?.count ?? 0) > 0;
  }

  private async applyForeignKeys(queryRunner: QueryRunner): Promise<void> {
    for (const foreignKey of foreignKeys) {
      if (!(await this.hasTable(queryRunner, foreignKey.table))) continue;
      if (await this.hasConstraint(queryRunner, foreignKey.name)) continue;

      const onDelete = foreignKey.onDelete
        ? ` ON DELETE ${foreignKey.onDelete}`
        : '';
      const onUpdate = foreignKey.onUpdate
        ? ` ON UPDATE ${foreignKey.onUpdate}`
        : '';
      await queryRunner.query(
        `ALTER TABLE \`${foreignKey.table}\`
         ADD CONSTRAINT \`${foreignKey.name}\`
         FOREIGN KEY (\`${foreignKey.column}\`)
         REFERENCES \`${foreignKey.referencedTable}\` (\`${foreignKey.referencedColumn}\`)${onDelete}${onUpdate}`,
      );
    }
  }

  private async modifyColumns(
    queryRunner: QueryRunner,
    type: 'BIGINT' | 'INT',
  ): Promise<void> {
    for (const column of bigintColumns) {
      if (!(await this.hasTable(queryRunner, column.table))) continue;
      const nullable = column.nullable ? 'NULL' : 'NOT NULL';
      const autoIncrement = primaryKeys.some(
        (primaryKey) =>
          primaryKey.table === column.table &&
          primaryKey.column === column.column,
      )
        ? ' AUTO_INCREMENT'
        : '';
      const defaultClause =
        column.table === 'categories' && column.column === 'parent_id'
          ? type === 'BIGINT'
            ? ' DEFAULT NULL'
            : ' DEFAULT 0'
          : '';
      await queryRunner.query(
        `ALTER TABLE \`${column.table}\` MODIFY COLUMN \`${column.column}\` ${type} ${nullable}${defaultClause}${autoIncrement}`,
      );
    }
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.dropForeignKeys(queryRunner);

    if (await this.hasTable(queryRunner, 'categories')) {
      await queryRunner.query(
        'UPDATE `categories` SET `parent_id` = NULL WHERE `parent_id` = 0',
      );
    }

    await this.modifyColumns(queryRunner, 'BIGINT');
    await this.applyForeignKeys(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.dropForeignKeys(queryRunner);

    if (await this.hasTable(queryRunner, 'categories')) {
      await queryRunner.query(
        'UPDATE `categories` SET `parent_id` = 0 WHERE `parent_id` IS NULL',
      );
    }

    await this.modifyColumns(queryRunner, 'INT');
    await this.applyForeignKeys(queryRunner);
  }
}
