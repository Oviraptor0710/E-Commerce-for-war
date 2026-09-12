import { MigrationInterface, QueryRunner } from 'typeorm';

export class CompleteRewardAiSchema1784913423843
  implements MigrationInterface
{
  name = 'CompleteRewardAiSchema1784913423843';

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

  private async hasColumn(
    queryRunner: QueryRunner,
    tableName: string,
    columnName: string,
  ): Promise<boolean> {
    const rows = await queryRunner.query(
      `SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [tableName, columnName],
    );
    return Number(rows[0]?.count ?? 0) > 0;
  }

  private async hasIndex(
    queryRunner: QueryRunner,
    tableName: string,
    indexName: string,
  ): Promise<boolean> {
    const rows = await queryRunner.query(
      `SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
      [tableName, indexName],
    );
    return Number(rows[0]?.count ?? 0) > 0;
  }

  private async hasConstraint(
    queryRunner: QueryRunner,
    tableName: string,
    constraintName: string,
  ): Promise<boolean> {
    const rows = await queryRunner.query(
      `SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
       WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?`,
      [tableName, constraintName],
    );
    return Number(rows[0]?.count ?? 0) > 0;
  }

  private async assertNoNulls(
    queryRunner: QueryRunner,
    tableName: string,
    columnName: string,
  ): Promise<void> {
    const rows = await queryRunner.query(
      `SELECT COUNT(*) AS count FROM \`${tableName}\`
       WHERE \`${columnName}\` IS NULL`,
    );
    if (Number(rows[0]?.count ?? 0) > 0) {
      throw new Error(
        `Cannot make ${tableName}.${columnName} NOT NULL while NULL data exists.`,
      );
    }
  }

  private async addCheck(
    queryRunner: QueryRunner,
    tableName: string,
    name: string,
    expression: string,
  ): Promise<void> {
    if (await this.hasConstraint(queryRunner, tableName, name)) return;
    await queryRunner.query(
      `ALTER TABLE \`${tableName}\` ADD CONSTRAINT \`${name}\` CHECK (${expression})`,
    );
  }

  private async addForeignKey(
    queryRunner: QueryRunner,
    tableName: string,
    name: string,
    column: string,
    referencedTable: string,
    referencedColumn: string,
  ): Promise<void> {
    if (await this.hasConstraint(queryRunner, tableName, name)) return;
    await queryRunner.query(
      `ALTER TABLE \`${tableName}\`
       ADD CONSTRAINT \`${name}\`
       FOREIGN KEY (\`${column}\`)
       REFERENCES \`${referencedTable}\` (\`${referencedColumn}\`)
       ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  private async dropForeignKey(
    queryRunner: QueryRunner,
    tableName: string,
    columnName: string,
  ): Promise<void> {
    const rows = await queryRunner.query(
      `SELECT DISTINCT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
       WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ?
         AND COLUMN_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL`,
      [tableName, columnName],
    );
    for (const row of rows as Array<{ CONSTRAINT_NAME: string }>) {
      await queryRunner.query(
        `ALTER TABLE \`${tableName}\` DROP FOREIGN KEY \`${row.CONSTRAINT_NAME}\``,
      );
    }
  }

  private async completeRewardRules(queryRunner: QueryRunner): Promise<void> {
    if (!(await this.hasTable(queryRunner, 'reward_rules'))) return;

    const hasBattleType = await this.hasColumn(
      queryRunner,
      'reward_rules',
      'battle_type',
    );
    const hasAchievementType = await this.hasColumn(
      queryRunner,
      'reward_rules',
      'achievement_type',
    );
    if (hasBattleType && !hasAchievementType) {
      await queryRunner.query(
        'ALTER TABLE `reward_rules` CHANGE COLUMN `battle_type` `achievement_type` VARCHAR(100) NULL',
      );
    }
    if (!hasAchievementType && !hasBattleType) {
      await queryRunner.query(
        'ALTER TABLE `reward_rules` ADD COLUMN `achievement_type` VARCHAR(100) NULL',
      );
    }
    await queryRunner.query(
      "UPDATE `reward_rules` SET `achievement_type` = 'legacy' WHERE `achievement_type` IS NULL OR `achievement_type` = ''",
    );
    await queryRunner.query(
      'ALTER TABLE `reward_rules` MODIFY COLUMN `achievement_type` VARCHAR(100) NOT NULL',
    );

    if (!(await this.hasColumn(queryRunner, 'reward_rules', 'achievement_name'))) {
      await queryRunner.query(
        "ALTER TABLE `reward_rules` ADD COLUMN `achievement_name` VARCHAR(255) NOT NULL DEFAULT 'Unnamed reward' AFTER `achievement_type`",
      );
    }
    if (!(await this.hasColumn(queryRunner, 'reward_rules', 'min_ai_score'))) {
      await queryRunner.query(
        'ALTER TABLE `reward_rules` ADD COLUMN `min_ai_score` DECIMAL(5,4) NULL',
      );
    }
    if (!(await this.hasColumn(queryRunner, 'reward_rules', 'max_reward_per_day'))) {
      await queryRunner.query(
        'ALTER TABLE `reward_rules` ADD COLUMN `max_reward_per_day` DECIMAL(20,3) NULL',
      );
    }
    if (!(await this.hasColumn(queryRunner, 'reward_rules', 'is_active'))) {
      await queryRunner.query(
        'ALTER TABLE `reward_rules` ADD COLUMN `is_active` TINYINT(1) NOT NULL DEFAULT 1',
      );
    }
    if (!(await this.hasColumn(queryRunner, 'reward_rules', 'icon_url'))) {
      await queryRunner.query(
        'ALTER TABLE `reward_rules` ADD COLUMN `icon_url` VARCHAR(512) NULL',
      );
    }
    if (!(await this.hasColumn(queryRunner, 'reward_rules', 'description'))) {
      await queryRunner.query(
        'ALTER TABLE `reward_rules` ADD COLUMN `description` TEXT NULL',
      );
    }

    await queryRunner.query(
      'UPDATE `reward_rules` SET `reward_coin` = 0 WHERE `reward_coin` IS NULL',
    );
    await queryRunner.query(
      "ALTER TABLE `reward_rules` MODIFY COLUMN `reward_coin` DECIMAL(20,3) NOT NULL DEFAULT '0.000'",
    );

    if (!(await this.hasIndex(queryRunner, 'reward_rules', 'uq_reward_rules_achievement_type'))) {
      await queryRunner.query(
        'ALTER TABLE `reward_rules` ADD UNIQUE INDEX `uq_reward_rules_achievement_type` (`achievement_type`)',
      );
    }
    await this.addCheck(
      queryRunner,
      'reward_rules',
      'chk_reward_rules_reward_coin_non_negative',
      'reward_coin >= 0',
    );
    await this.addCheck(
      queryRunner,
      'reward_rules',
      'chk_reward_rules_min_ai_score_range',
      'min_ai_score IS NULL OR (min_ai_score >= 0 AND min_ai_score <= 1)',
    );
  }

  private async completeRewardProofs(queryRunner: QueryRunner): Promise<void> {
    if (!(await this.hasTable(queryRunner, 'reward_proofs'))) return;

    if (
      (await this.hasColumn(queryRunner, 'reward_proofs', 'video_url')) &&
      !(await this.hasColumn(queryRunner, 'reward_proofs', 'video_storage_key'))
    ) {
      await queryRunner.query(
        'ALTER TABLE `reward_proofs` CHANGE COLUMN `video_url` `video_storage_key` VARCHAR(1024) NULL',
      );
    }
    if (!(await this.hasColumn(queryRunner, 'reward_proofs', 'video_storage_key'))) {
      await queryRunner.query(
        'ALTER TABLE `reward_proofs` ADD COLUMN `video_storage_key` VARCHAR(1024) NULL',
      );
    }
    await this.assertNoNulls(queryRunner, 'reward_proofs', 'video_storage_key');
    await queryRunner.query(
      'ALTER TABLE `reward_proofs` MODIFY COLUMN `video_storage_key` VARCHAR(1024) NOT NULL',
    );

    if (await this.hasColumn(queryRunner, 'reward_proofs', 'image_url')) {
      await queryRunner.query('ALTER TABLE `reward_proofs` DROP COLUMN `image_url`');
    }
    if (!(await this.hasColumn(queryRunner, 'reward_proofs', 'ai_model_version'))) {
      await queryRunner.query(
        'ALTER TABLE `reward_proofs` ADD COLUMN `ai_model_version` VARCHAR(100) NULL',
      );
    }
    if (!(await this.hasColumn(queryRunner, 'reward_proofs', 'ai_evaluated_at'))) {
      await queryRunner.query(
        'ALTER TABLE `reward_proofs` ADD COLUMN `ai_evaluated_at` DATETIME(6) NULL',
      );
    }
    if (!(await this.hasColumn(queryRunner, 'reward_proofs', 'rejection_reason'))) {
      await queryRunner.query(
        'ALTER TABLE `reward_proofs` ADD COLUMN `rejection_reason` TEXT NULL',
      );
    }
    if (!(await this.hasColumn(queryRunner, 'reward_proofs', 'media_retention_until'))) {
      await queryRunner.query(
        'ALTER TABLE `reward_proofs` ADD COLUMN `media_retention_until` DATETIME(6) NULL',
      );
    }
    if (!(await this.hasColumn(queryRunner, 'reward_proofs', 'media_deleted_at'))) {
      await queryRunner.query(
        'ALTER TABLE `reward_proofs` ADD COLUMN `media_deleted_at` DATETIME(6) NULL',
      );
    }
    await queryRunner.query(
      'UPDATE `reward_proofs` SET `media_retention_until` = DATE_ADD(`created_at`, INTERVAL 1 YEAR) WHERE `media_retention_until` IS NULL',
    );
    await this.assertNoNulls(queryRunner, 'reward_proofs', 'media_retention_until');
    await queryRunner.query(
      'ALTER TABLE `reward_proofs` MODIFY COLUMN `media_retention_until` DATETIME(6) NOT NULL',
    );

    await queryRunner.query(
      'ALTER TABLE `reward_proofs` MODIFY COLUMN `ai_score` DECIMAL(5,4) NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `reward_proofs` MODIFY COLUMN `reward_coin` DECIMAL(20,3) NULL',
    );
    await queryRunner.query(
      "UPDATE `reward_proofs` SET `status` = 'uploaded' WHERE `status` IS NULL OR `status` = ''",
    );
    await queryRunner.query(
      "ALTER TABLE `reward_proofs` MODIFY COLUMN `status` ENUM('uploaded','processing','rewarded','rejected','failed','media_deleted') NOT NULL DEFAULT 'uploaded'",
    );

    if (await this.hasColumn(queryRunner, 'reward_proofs', 'reviewed_by')) {
      await queryRunner.query('ALTER TABLE `reward_proofs` DROP COLUMN `reviewed_by`');
    }
    if (await this.hasColumn(queryRunner, 'reward_proofs', 'reviewed_at')) {
      await queryRunner.query('ALTER TABLE `reward_proofs` DROP COLUMN `reviewed_at`');
    }

    if (!(await this.hasIndex(queryRunner, 'reward_proofs', 'idx_reward_proofs_user_created'))) {
      await queryRunner.query(
        'ALTER TABLE `reward_proofs` ADD INDEX `idx_reward_proofs_user_created` (`user_id`, `created_at`)',
      );
    }
    if (!(await this.hasIndex(queryRunner, 'reward_proofs', 'idx_reward_proofs_retention'))) {
      await queryRunner.query(
        'ALTER TABLE `reward_proofs` ADD INDEX `idx_reward_proofs_retention` (`status`, `media_retention_until`)',
      );
    }
    await this.addCheck(
      queryRunner,
      'reward_proofs',
      'chk_reward_proofs_video_storage_key_required',
      'video_storage_key IS NOT NULL AND CHAR_LENGTH(video_storage_key) > 0',
    );
    await this.addCheck(
      queryRunner,
      'reward_proofs',
      'chk_reward_proofs_ai_score_range',
      'ai_score IS NULL OR (ai_score >= 0 AND ai_score <= 1)',
    );
    await this.addCheck(
      queryRunner,
      'reward_proofs',
      'chk_reward_proofs_reward_coin_non_negative',
      'reward_coin IS NULL OR reward_coin >= 0',
    );
  }

  private async completeRewardAppeals(queryRunner: QueryRunner): Promise<void> {
    if (!(await this.hasTable(queryRunner, 'reward_appeals'))) return;

    await this.dropForeignKey(queryRunner, 'reward_appeals', 'proof_id');
    await this.assertNoNulls(queryRunner, 'reward_appeals', 'proof_id');
    await queryRunner.query(
      "UPDATE `reward_appeals` SET `status` = 'pending' WHERE `status` IS NULL OR `status` = ''",
    );
    await queryRunner.query(
      "ALTER TABLE `reward_appeals` MODIFY COLUMN `proof_id` BIGINT NOT NULL, MODIFY COLUMN `status` ENUM('pending','accepted','rejected') NOT NULL DEFAULT 'pending'",
    );
    await this.addForeignKey(
      queryRunner,
      'reward_appeals',
      'fk_reward_appeals_proof',
      'proof_id',
      'reward_proofs',
      'id',
    );
  }

  private async createAchievementTables(queryRunner: QueryRunner): Promise<void> {
    if (!(await this.hasTable(queryRunner, 'proof_achievements'))) {
      await queryRunner.query(`
        CREATE TABLE proof_achievements (
          id BIGINT NOT NULL AUTO_INCREMENT,
          proof_id BIGINT NOT NULL,
          rule_id BIGINT NOT NULL,
          quantity INT NOT NULL,
          ai_confidence DECIMAL(5,4) NOT NULL,
          reward_earned DECIMAL(20,3) NOT NULL,
          created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          UNIQUE INDEX uq_proof_achievements_proof_rule (proof_id, rule_id),
          PRIMARY KEY (id),
          CONSTRAINT chk_proof_achievements_quantity_positive CHECK (quantity > 0),
          CONSTRAINT chk_proof_achievements_confidence_range CHECK (ai_confidence >= 0 AND ai_confidence <= 1),
          CONSTRAINT chk_proof_achievements_reward_non_negative CHECK (reward_earned >= 0),
          CONSTRAINT fk_proof_achievements_proof FOREIGN KEY (proof_id) REFERENCES reward_proofs(id) ON DELETE RESTRICT,
          CONSTRAINT fk_proof_achievements_rule FOREIGN KEY (rule_id) REFERENCES reward_rules(id) ON DELETE RESTRICT
        ) ENGINE=InnoDB
      `);
    }

    if (!(await this.hasTable(queryRunner, 'ai_evaluation_logs'))) {
      await queryRunner.query(`
        CREATE TABLE ai_evaluation_logs (
          id BIGINT NOT NULL AUTO_INCREMENT,
          proof_id BIGINT NOT NULL,
          attempt_no INT NOT NULL,
          model_name VARCHAR(150) NOT NULL,
          model_version VARCHAR(100) NOT NULL,
          input_data JSON NULL,
          output_data JSON NULL,
          score DECIMAL(5,4) NULL,
          processing_time_ms INT NULL,
          status ENUM('processing','succeeded','failed') NOT NULL,
          error_message TEXT NULL,
          created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          UNIQUE INDEX uq_ai_evaluation_logs_proof_attempt (proof_id, attempt_no),
          INDEX idx_ai_evaluation_logs_proof_created (proof_id, created_at),
          PRIMARY KEY (id),
          CONSTRAINT fk_ai_evaluation_logs_proof FOREIGN KEY (proof_id) REFERENCES reward_proofs(id) ON DELETE RESTRICT
        ) ENGINE=InnoDB
      `);
    }
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.completeRewardRules(queryRunner);
    await this.completeRewardProofs(queryRunner);
    await this.completeRewardAppeals(queryRunner);
    await this.createAchievementTables(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await this.hasTable(queryRunner, 'ai_evaluation_logs')) {
      await queryRunner.query('DROP TABLE `ai_evaluation_logs`');
    }
    if (await this.hasTable(queryRunner, 'proof_achievements')) {
      await queryRunner.query('DROP TABLE `proof_achievements`');
    }

    if (await this.hasTable(queryRunner, 'reward_appeals')) {
      await queryRunner.query(
        'ALTER TABLE `reward_appeals` MODIFY COLUMN `proof_id` BIGINT NULL, MODIFY COLUMN `status` VARCHAR(255) NULL',
      );
    }

    if (await this.hasTable(queryRunner, 'reward_proofs')) {
      for (const check of [
        'chk_reward_proofs_video_storage_key_required',
        'chk_reward_proofs_ai_score_range',
        'chk_reward_proofs_reward_coin_non_negative',
      ]) {
        if (await this.hasConstraint(queryRunner, 'reward_proofs', check)) {
          await queryRunner.query(`ALTER TABLE \`reward_proofs\` DROP CHECK \`${check}\``);
        }
      }
      if (await this.hasColumn(queryRunner, 'reward_proofs', 'media_deleted_at')) {
        await queryRunner.query('ALTER TABLE `reward_proofs` DROP COLUMN `media_deleted_at`');
      }
      if (await this.hasColumn(queryRunner, 'reward_proofs', 'media_retention_until')) {
        await queryRunner.query('ALTER TABLE `reward_proofs` DROP COLUMN `media_retention_until`');
      }
      if (await this.hasColumn(queryRunner, 'reward_proofs', 'rejection_reason')) {
        await queryRunner.query('ALTER TABLE `reward_proofs` DROP COLUMN `rejection_reason`');
      }
      if (await this.hasColumn(queryRunner, 'reward_proofs', 'ai_evaluated_at')) {
        await queryRunner.query('ALTER TABLE `reward_proofs` DROP COLUMN `ai_evaluated_at`');
      }
      if (await this.hasColumn(queryRunner, 'reward_proofs', 'ai_model_version')) {
        await queryRunner.query('ALTER TABLE `reward_proofs` DROP COLUMN `ai_model_version`');
      }
      await queryRunner.query(
        "ALTER TABLE `reward_proofs` MODIFY COLUMN `status` VARCHAR(255) NULL, MODIFY COLUMN `ai_score` DECIMAL(10,0) NULL, MODIFY COLUMN `reward_coin` DECIMAL(10,0) NULL",
      );
      if (await this.hasColumn(queryRunner, 'reward_proofs', 'video_storage_key')) {
        await queryRunner.query(
          'ALTER TABLE `reward_proofs` CHANGE COLUMN `video_storage_key` `video_url` VARCHAR(255) NULL',
        );
      }
    }

    if (await this.hasTable(queryRunner, 'reward_rules')) {
      for (const check of [
        'chk_reward_rules_reward_coin_non_negative',
        'chk_reward_rules_min_ai_score_range',
      ]) {
        if (await this.hasConstraint(queryRunner, 'reward_rules', check)) {
          await queryRunner.query(`ALTER TABLE \`reward_rules\` DROP CHECK \`${check}\``);
        }
      }
      if (await this.hasIndex(queryRunner, 'reward_rules', 'uq_reward_rules_achievement_type')) {
        await queryRunner.query(
          'ALTER TABLE `reward_rules` DROP INDEX `uq_reward_rules_achievement_type`',
        );
      }
      for (const column of [
        'description',
        'icon_url',
        'is_active',
        'max_reward_per_day',
        'min_ai_score',
        'achievement_name',
      ]) {
        if (await this.hasColumn(queryRunner, 'reward_rules', column)) {
          await queryRunner.query(`ALTER TABLE \`reward_rules\` DROP COLUMN \`${column}\``);
        }
      }
      await queryRunner.query(
        "ALTER TABLE `reward_rules` MODIFY COLUMN `reward_coin` DECIMAL(10,0) NULL, CHANGE COLUMN `achievement_type` `battle_type` VARCHAR(255) NULL",
      );
    }
  }
}
