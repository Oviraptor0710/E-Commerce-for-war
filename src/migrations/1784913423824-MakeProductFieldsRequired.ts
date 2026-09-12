import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeProductFieldsRequired1784913423824
  implements MigrationInterface
{
  name = 'MakeProductFieldsRequired1784913423824';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const invalidRows = await queryRunner.query(`
      SELECT COUNT(*) AS count
      FROM products
      WHERE title IS NULL OR category_id IS NULL
    `);

    if (Number(invalidRows[0]?.count || 0) > 0) {
      throw new Error(
        'Cannot make product fields required: existing products contain NULL title or category_id.',
      );
    }

    await queryRunner.query(`
      ALTER TABLE products
        MODIFY COLUMN title VARCHAR(255) NOT NULL,
        MODIFY COLUMN category_id INT NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE products
        MODIFY COLUMN title VARCHAR(255) NULL,
        MODIFY COLUMN category_id INT NULL
    `);
  }
}
