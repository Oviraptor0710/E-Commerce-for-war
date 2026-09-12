import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCommentMedia1784913423844 implements MigrationInterface {
  name = 'AddCommentMedia1784913423844';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const oversizedComments = await queryRunner.query(
      'SELECT COUNT(*) AS count FROM `comments` WHERE CHAR_LENGTH(`content`) > 2000',
    );
    if (Number(oversizedComments[0]?.count ?? 0) > 0) {
      throw new Error(
        'Cannot enforce the 2000-character comment limit while oversized comments exist.',
      );
    }

    await queryRunner.query(
      'ALTER TABLE `comments` ADD COLUMN `idempotency_key` VARCHAR(150) NULL, ADD COLUMN `request_hash` VARCHAR(64) NULL',
    );
    await queryRunner.query(
      "UPDATE `comments` SET `idempotency_key` = CONCAT('legacy:', `id`), `request_hash` = SHA2(CONCAT('legacy-comment:', `id`), 256) WHERE `idempotency_key` IS NULL OR `request_hash` IS NULL",
    );
    await queryRunner.query(
      'ALTER TABLE `comments` MODIFY COLUMN `idempotency_key` VARCHAR(150) NOT NULL, MODIFY COLUMN `request_hash` VARCHAR(64) NOT NULL, MODIFY COLUMN `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX `uq_comments_user_idempotency` ON `comments` (`user_id`, `idempotency_key`)',
    );
    await queryRunner.query(
      'CREATE INDEX `idx_comments_product_created` ON `comments` (`product_id`, `created_at`, `id`)',
    );
    await queryRunner.query(
      'ALTER TABLE `comments` ADD CONSTRAINT `chk_comments_content_length` CHECK (`content` IS NULL OR CHAR_LENGTH(`content`) <= 2000)',
    );

    await queryRunner.query(`
      CREATE TABLE \`media_assets\` (
        \`id\` BIGINT NOT NULL AUTO_INCREMENT,
        \`uploader_id\` BIGINT NOT NULL,
        \`media_type\` ENUM('image','video') NOT NULL,
        \`storage_key\` VARCHAR(512) NOT NULL,
        \`mime_type\` VARCHAR(100) NOT NULL,
        \`size_bytes\` BIGINT UNSIGNED NOT NULL,
        \`duration_ms\` INT UNSIGNED NULL,
        \`status\` ENUM('temporary','attached','deleting') NOT NULL DEFAULT 'temporary',
        \`expires_at\` DATETIME(6) NULL,
        \`attached_at\` DATETIME(6) NULL,
        \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`uq_media_assets_storage_key\` (\`storage_key\`),
        INDEX \`idx_media_assets_cleanup\` (\`status\`, \`expires_at\`),
        INDEX \`idx_media_assets_owner_status\` (\`uploader_id\`, \`status\`, \`id\`),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`chk_media_assets_size_positive\` CHECK (\`size_bytes\` > 0),
        CONSTRAINT \`chk_media_assets_type_limits\` CHECK (
          (\`media_type\` = 'image' AND \`size_bytes\` <= 3145728 AND \`duration_ms\` IS NULL)
          OR
          (\`media_type\` = 'video' AND \`size_bytes\` <= 104857600 AND \`duration_ms\` BETWEEN 1 AND 60000)
        ),
        CONSTRAINT \`chk_media_assets_lifecycle\` CHECK (
          (\`status\` = 'temporary' AND \`expires_at\` IS NOT NULL AND \`attached_at\` IS NULL)
          OR
          (\`status\` = 'attached' AND \`expires_at\` IS NULL AND \`attached_at\` IS NOT NULL)
          OR
          (\`status\` = 'deleting' AND \`expires_at\` IS NOT NULL AND \`attached_at\` IS NULL)
        ),
        CONSTRAINT \`fk_media_assets_uploader\` FOREIGN KEY (\`uploader_id\`) REFERENCES \`users\` (\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE \`comment_media\` (
        \`id\` BIGINT NOT NULL AUTO_INCREMENT,
        \`comment_id\` BIGINT NOT NULL,
        \`media_asset_id\` BIGINT NOT NULL,
        \`position\` TINYINT UNSIGNED NOT NULL,
        \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`uq_comment_media_asset\` (\`media_asset_id\`),
        UNIQUE INDEX \`uq_comment_media_position\` (\`comment_id\`, \`position\`),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`chk_comment_media_position\` CHECK (\`position\` BETWEEN 1 AND 4),
        CONSTRAINT \`fk_comment_media_comment\` FOREIGN KEY (\`comment_id\`) REFERENCES \`comments\` (\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT \`fk_comment_media_asset\` FOREIGN KEY (\`media_asset_id\`) REFERENCES \`media_assets\` (\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `comment_media`');
    await queryRunner.query('DROP TABLE `media_assets`');
    await queryRunner.query(
      'ALTER TABLE `comments` DROP CHECK `chk_comments_content_length`',
    );
    await queryRunner.query(
      'DROP INDEX `idx_comments_product_created` ON `comments`',
    );
    await queryRunner.query(
      'DROP INDEX `uq_comments_user_idempotency` ON `comments`',
    );
    await queryRunner.query(
      'ALTER TABLE `comments` DROP COLUMN `request_hash`, DROP COLUMN `idempotency_key`',
    );
  }
}
