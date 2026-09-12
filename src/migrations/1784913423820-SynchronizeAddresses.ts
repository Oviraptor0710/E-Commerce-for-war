import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Makes buyer/seller addresses immutable records without coordinates.
 * The application creates a new address when any address content changes;
 * existing records are only selected as default or soft-deleted.
 */
export class SynchronizeAddresses1784913423820 implements MigrationInterface {
  name = 'SynchronizeAddresses1784913423820';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const invalidDataChecks: Array<{ name: string; sql: string }> = [
      {
        name: 'address detail is missing',
        sql: `SELECT id FROM addresses WHERE address_detail IS NULL OR TRIM(address_detail) = '' LIMIT 1`,
      },
      {
        name: 'receiver name is missing',
        sql: `SELECT id FROM addresses WHERE receiver_name IS NULL OR TRIM(receiver_name) = '' LIMIT 1`,
      },
      {
        name: 'phone number is missing',
        sql: `SELECT id FROM addresses WHERE phone IS NULL OR TRIM(phone) = '' LIMIT 1`,
      },
      {
        name: 'phone number is too long',
        sql: `SELECT id FROM addresses WHERE CHAR_LENGTH(phone) > 30 LIMIT 1`,
      },
      {
        name: 'address name is too long',
        sql: `SELECT id FROM addresses WHERE address_name IS NOT NULL AND CHAR_LENGTH(address_name) > 100 LIMIT 1`,
      },
    ];

    for (const check of invalidDataChecks) {
      const rows = await queryRunner.query(check.sql);
      if (rows.length > 0) {
        throw new Error(`Cannot synchronize addresses table: ${check.name}.`);
      }
    }

    await queryRunner.query(`
      UPDATE addresses
      SET address_detail = TRIM(address_detail),
          receiver_name = TRIM(receiver_name),
          phone = TRIM(phone),
          address_name = NULLIF(TRIM(address_name), '')
    `);

    await queryRunner.query(`
      ALTER TABLE addresses
      DROP COLUMN lat,
      DROP COLUMN lng,
      MODIFY address_name VARCHAR(100) NULL,
      MODIFY address_detail TEXT NOT NULL,
      MODIFY phone VARCHAR(30) NOT NULL
    `);

    await queryRunner.query(
      `CREATE INDEX idx_addresses_user_list ON addresses (user_id, deleted_at, is_default)`,
    );
    await queryRunner.query(
      `ALTER TABLE addresses ADD CONSTRAINT chk_addresses_default_boolean CHECK (is_default IN (0, 1))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE addresses DROP CONSTRAINT chk_addresses_default_boolean`,
    );
    await queryRunner.query(`DROP INDEX idx_addresses_user_list ON addresses`);
    await queryRunner.query(`
      ALTER TABLE addresses
      ADD COLUMN lat DECIMAL(10, 8) NULL,
      ADD COLUMN lng DECIMAL(11, 8) NULL,
      MODIFY address_name VARCHAR(255) NULL,
      MODIFY address_detail TEXT NULL,
      MODIFY phone VARCHAR(255) NOT NULL
    `);
  }
}
