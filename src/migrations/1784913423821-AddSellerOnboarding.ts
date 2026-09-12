import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds seller onboarding as a capability layered on top of a normal user.
 * Existing product/order rows cannot be mapped to an approved application
 * safely, so the migration stops before DDL when such legacy rows exist.
 */
export class AddSellerOnboarding1784913423821 implements MigrationInterface {
  name = 'AddSellerOnboarding1784913423821';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const legacyProducts = await queryRunner.query(
      `SELECT id FROM products LIMIT 1`,
    );
    const legacyOrders = await queryRunner.query(`SELECT id FROM orders LIMIT 1`);

    if (legacyProducts.length > 0 || legacyOrders.length > 0) {
      throw new Error(
        'Cannot add seller onboarding automatically: products/orders already contain legacy seller data.',
      );
    }

    await queryRunner.query(`
      CREATE TABLE seller_applications (
        id BIGINT NOT NULL AUTO_INCREMENT,
        applicant_id INT NOT NULL,
        shop_name VARCHAR(255) NOT NULL,
        description TEXT NULL,
        ship_from_address_id INT NOT NULL,
        ship_from_full_address_snapshot TEXT NOT NULL,
        status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
        reviewed_by INT NULL,
        reviewed_at DATETIME(6) NULL,
        rejection_reason TEXT NULL,
        submitted_at DATETIME(6) NOT NULL,
        created_at DATETIME(6) NOT NULL,
        updated_at DATETIME(6) NOT NULL,
        PRIMARY KEY (id),
        INDEX idx_seller_applications_admin_queue (status, submitted_at, id),
        INDEX idx_seller_applications_user_history (applicant_id, status, created_at, id),
        INDEX idx_seller_applications_reviewed_by (reviewed_by),
        INDEX idx_seller_applications_ship_from (ship_from_address_id),
        CONSTRAINT fk_seller_applications_applicant
          FOREIGN KEY (applicant_id) REFERENCES users(id) ON DELETE RESTRICT,
        CONSTRAINT fk_seller_applications_reviewer
          FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE RESTRICT,
        CONSTRAINT fk_seller_applications_ship_from
          FOREIGN KEY (ship_from_address_id) REFERENCES addresses(id) ON DELETE RESTRICT,
        CONSTRAINT chk_seller_applications_pending_state
          CHECK (status <> 'pending' OR (reviewed_by IS NULL AND reviewed_at IS NULL AND rejection_reason IS NULL)),
        CONSTRAINT chk_seller_applications_approved_state
          CHECK (status <> 'approved' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND rejection_reason IS NULL)),
        CONSTRAINT chk_seller_applications_rejected_state
          CHECK (status <> 'rejected' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND rejection_reason IS NOT NULL)),
        CONSTRAINT chk_seller_applications_reviewed_after_submit
          CHECK (reviewed_at IS NULL OR reviewed_at >= submitted_at),
        CONSTRAINT chk_seller_applications_submitted_after_create
          CHECK (submitted_at >= created_at),
        CONSTRAINT chk_seller_applications_updated_after_create
          CHECK (updated_at >= created_at)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE seller_profiles (
        user_id INT NOT NULL,
        approved_application_id BIGINT NOT NULL,
        shop_name VARCHAR(255) NOT NULL,
        description TEXT NULL,
        default_ship_from_address_id INT NOT NULL,
        status ENUM('active', 'suspended') NOT NULL DEFAULT 'active',
        approved_at DATETIME(6) NOT NULL,
        created_at DATETIME(6) NOT NULL,
        updated_at DATETIME(6) NOT NULL,
        PRIMARY KEY (user_id),
        UNIQUE INDEX uq_seller_profiles_approved_application (approved_application_id),
        INDEX idx_seller_profiles_status (status),
        INDEX idx_seller_profiles_default_ship_from (default_ship_from_address_id),
        CONSTRAINT fk_seller_profiles_user
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
        CONSTRAINT fk_seller_profiles_approved_application
          FOREIGN KEY (approved_application_id) REFERENCES seller_applications(id) ON DELETE RESTRICT,
        CONSTRAINT fk_seller_profiles_default_ship_from
          FOREIGN KEY (default_ship_from_address_id) REFERENCES addresses(id) ON DELETE RESTRICT,
        CONSTRAINT chk_seller_profiles_created_after_approval
          CHECK (created_at >= approved_at),
        CONSTRAINT chk_seller_profiles_updated_after_create
          CHECK (updated_at >= created_at)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      ALTER TABLE products
      DROP FOREIGN KEY FK_425ee27c69d6b8adc5d6475dcfe,
      ADD CONSTRAINT fk_products_seller_profile
        FOREIGN KEY (seller_id) REFERENCES seller_profiles(user_id) ON DELETE RESTRICT
    `);

    await queryRunner.query(`
      ALTER TABLE orders
      DROP FOREIGN KEY FK_ef6710c78c6fbc26d1ba58268ab,
      ADD CONSTRAINT fk_orders_seller_profile
        FOREIGN KEY (seller_id) REFERENCES seller_profiles(user_id) ON DELETE RESTRICT
    `);

    await queryRunner.query(`
      ALTER TABLE addresses
      DROP FOREIGN KEY FK_16aac8a9f6f9c1dd6bcb75ec023,
      ADD CONSTRAINT fk_addresses_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE products
      DROP FOREIGN KEY fk_products_seller_profile,
      ADD CONSTRAINT FK_425ee27c69d6b8adc5d6475dcfe
        FOREIGN KEY (seller_id) REFERENCES users(id)
    `);

    await queryRunner.query(`
      ALTER TABLE orders
      DROP FOREIGN KEY fk_orders_seller_profile,
      ADD CONSTRAINT FK_ef6710c78c6fbc26d1ba58268ab
        FOREIGN KEY (seller_id) REFERENCES users(id)
    `);

    await queryRunner.query(`
      ALTER TABLE addresses
      DROP FOREIGN KEY fk_addresses_user,
      ADD CONSTRAINT FK_16aac8a9f6f9c1dd6bcb75ec023
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    `);

    await queryRunner.query(`DROP TABLE seller_profiles`);
    await queryRunner.query(`DROP TABLE seller_applications`);
  }
}
