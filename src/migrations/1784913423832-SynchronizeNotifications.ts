import { MigrationInterface, QueryRunner } from 'typeorm';

export class SynchronizeNotifications1784913423832 implements MigrationInterface {
  name = 'SynchronizeNotifications1784913423832';

  public async up(q: QueryRunner): Promise<void> {
    const columnExists = async (column: string) => {
      const rows = await q.query(
        `SELECT COUNT(*) count
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = ?`,
        [column],
      );
      return Number(rows[0]?.count || 0) > 0;
    };

    const indexExists = async (index: string) => {
      const rows = await q.query(
        `SELECT COUNT(*) count
         FROM INFORMATION_SCHEMA.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND INDEX_NAME = ?`,
        [index],
      );
      return Number(rows[0]?.count || 0) > 0;
    };

    const foreignKeyColumns = async (column: string) => q.query(
      `SELECT DISTINCT CONSTRAINT_NAME
       FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'notifications'
         AND COLUMN_NAME = ?
         AND REFERENCED_TABLE_NAME IS NOT NULL`,
      [column],
    );

    const notificationTable = await q.query(
      `SELECT COUNT(*) count
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications'`,
    );
    if (Number(notificationTable[0]?.count || 0) === 0) {
      throw new Error('Cannot synchronize notifications: table does not exist.');
    }

    const invalidRecipients = await q.query(
      'SELECT COUNT(*) count FROM notifications WHERE user_id IS NULL',
    );
    if (Number(invalidRecipients[0]?.count || 0) > 0) {
      throw new Error('Cannot synchronize notifications: a notification has no recipient.');
    }

    // Drop legacy FKs first so user_id can be tightened and recreated with stable names.
    for (const fk of await foreignKeyColumns('user_id')) {
      await q.query(`ALTER TABLE notifications DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``);
    }
    for (const fk of await foreignKeyColumns('actor_id')) {
      await q.query(`ALTER TABLE notifications DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``);
    }

    const addColumn = async (column: string, definition: string) => {
      if (!(await columnExists(column))) {
        await q.query(`ALTER TABLE notifications ADD COLUMN \`${column}\` ${definition}`);
      }
    };

    await addColumn('actor_id', 'INT NULL');
    await addColumn('deduplication_key', 'VARCHAR(150) NULL');
    await addColumn('content', 'TEXT NULL');
    await addColumn('image_url', 'VARCHAR(512) NULL');
    await addColumn('is_navigable', 'TINYINT NOT NULL DEFAULT 0');
    await addColumn('target_type', 'VARCHAR(30) NULL');
    await addColumn('target_id', 'BIGINT NULL');
    await addColumn('data', 'JSON NULL');
    await addColumn('is_read', 'TINYINT NOT NULL DEFAULT 0');
    await addColumn('read_at', 'DATETIME(6) NULL');

    const createdAtColumn = await q.query(
      `SELECT DATA_TYPE
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'created_at'`,
    );
    if (createdAtColumn[0]?.DATA_TYPE === 'int' || createdAtColumn[0]?.DATA_TYPE === 'bigint') {
      await addColumn('created_at_v2', 'DATETIME(6) NULL');
      await q.query(
        `UPDATE notifications
         SET created_at_v2 = CASE
           WHEN created_at IS NULL OR created_at <= 0 THEN CURRENT_TIMESTAMP(6)
           ELSE FROM_UNIXTIME(created_at)
         END`,
      );
      await q.query('ALTER TABLE notifications DROP COLUMN `created_at`');
      await q.query('ALTER TABLE notifications CHANGE COLUMN `created_at_v2` `created_at` DATETIME(6) NOT NULL');
    } else {
      await q.query('ALTER TABLE notifications MODIFY `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)');
    }

    const legacyColumns = await q.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications'
         AND COLUMN_NAME IN ('product_id', 'object_id', 'avatar', 'group', 'read')`,
    );
    const legacy = new Set(legacyColumns.map((row: { COLUMN_NAME: string }) => row.COLUMN_NAME));

    if (legacy.has('avatar')) {
      await q.query('UPDATE notifications SET image_url = COALESCE(image_url, avatar)');
    }
    if (legacy.has('product_id') || legacy.has('object_id')) {
      const productId = legacy.has('product_id') ? '`product_id`' : 'NULL';
      const objectId = legacy.has('object_id') ? '`object_id`' : 'NULL';
      await q.query(`UPDATE notifications SET target_id = COALESCE(target_id, ${objectId}, ${productId})`);
    }
    if (legacy.has('read')) {
      await q.query('UPDATE notifications SET is_read = IF(COALESCE(`read`, 0) <> 0, 1, 0)');
      await q.query('UPDATE notifications SET read_at = CASE WHEN is_read = 1 THEN created_at ELSE NULL END');
    } else {
      await q.query('UPDATE notifications SET read_at = CASE WHEN is_read = 1 THEN created_at ELSE NULL END');
    }

    // Preserve navigability for the two legacy product notification types.
    await q.query(
      `UPDATE notifications
       SET target_type = CASE
         WHEN type IN ('comment_product', 'like_product', 'product_commented', 'product_liked')
              AND target_id IS NOT NULL THEN 'product'
         ELSE NULL
       END,
       is_navigable = CASE
         WHEN type IN ('comment_product', 'like_product', 'product_commented', 'product_liked')
              AND target_id IS NOT NULL THEN 1
         ELSE 0
       END`,
    );

    // Convert legacy notification names into the stable application enum.
    await q.query(
      `UPDATE notifications
       SET type = CASE
         WHEN type = 'comment_product' THEN 'product_commented'
         WHEN type = 'like_product' THEN 'product_liked'
         WHEN type IN (
           'product_liked', 'product_commented', 'review_received', 'new_follower',
           'order_created', 'order_confirmed', 'order_shipped', 'order_delivered',
           'order_completed', 'order_cancelled', 'refund_completed', 'reward_credited',
           'reward_not_detected', 'reward_processing_failed', 'points_refunded',
           'sale_points_released', 'new_message', 'system_announcement',
           'account_status_changed', 'security_alert', 'seller_application_approved',
           'seller_application_rejected'
         ) THEN type
         ELSE 'system_announcement'
       END`,
    );

    await q.query(
      `ALTER TABLE notifications
       MODIFY id BIGINT NOT NULL AUTO_INCREMENT,
       MODIFY user_id INT NOT NULL,
       MODIFY type ENUM(
         'product_liked', 'product_commented', 'review_received', 'new_follower',
         'order_created', 'order_confirmed', 'order_shipped', 'order_delivered',
         'order_completed', 'order_cancelled', 'refund_completed', 'reward_credited',
         'reward_not_detected', 'reward_processing_failed', 'points_refunded',
         'sale_points_released', 'new_message', 'system_announcement',
         'account_status_changed', 'security_alert', 'seller_application_approved',
         'seller_application_rejected'
       ) NOT NULL,
       MODIFY title VARCHAR(255) NOT NULL,
       MODIFY target_type ENUM(
         'product', 'user_profile', 'order', 'reward_result', 'wallet_transaction',
         'conversation', 'news', 'account_status', 'account_security', 'seller_application'
       ) NULL,
       MODIFY target_id BIGINT NULL,
       MODIFY is_navigable TINYINT NOT NULL DEFAULT 0,
       MODIFY is_read TINYINT NOT NULL DEFAULT 0,
       MODIFY created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)`);

    if (legacy.has('product_id')) await q.query('ALTER TABLE notifications DROP COLUMN `product_id`');
    if (legacy.has('object_id')) await q.query('ALTER TABLE notifications DROP COLUMN `object_id`');
    if (legacy.has('avatar')) await q.query('ALTER TABLE notifications DROP COLUMN `avatar`');
    if (legacy.has('group')) await q.query('ALTER TABLE notifications DROP COLUMN `group`');
    if (legacy.has('read')) await q.query('ALTER TABLE notifications DROP COLUMN `read`');

    if (!(await indexExists('uq_notifications_user_deduplication'))) {
      await q.query('ALTER TABLE notifications ADD UNIQUE INDEX uq_notifications_user_deduplication (user_id, deduplication_key)');
    }
    if (!(await indexExists('idx_notifications_user_inbox'))) {
      await q.query('ALTER TABLE notifications ADD INDEX idx_notifications_user_inbox (user_id, is_read, created_at)');
    }
    if (!(await indexExists('idx_notifications_target'))) {
      await q.query('ALTER TABLE notifications ADD INDEX idx_notifications_target (target_type, target_id)');
    }

    await q.query('ALTER TABLE notifications ADD CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE NO ACTION');
    await q.query('ALTER TABLE notifications ADD CONSTRAINT fk_notifications_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE NO ACTION');

    const checks = await q.query(
      `SELECT CONSTRAINT_NAME
       FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND CONSTRAINT_TYPE = 'CHECK'`,
    );
    const checkNames = new Set(checks.map((row: { CONSTRAINT_NAME: string }) => row.CONSTRAINT_NAME));
    const addCheck = async (name: string, expression: string) => {
      if (!checkNames.has(name)) await q.query(`ALTER TABLE notifications ADD CONSTRAINT ${name} CHECK (${expression})`);
    };
    await addCheck('chk_notifications_navigable_boolean', '`is_navigable` IN (0, 1)');
    await addCheck('chk_notifications_read_boolean', '`is_read` IN (0, 1)');
    await addCheck('chk_notifications_navigation_target', '`is_navigable` = 0 OR (`target_type` IS NOT NULL AND `target_id` IS NOT NULL)');
    await addCheck('chk_notifications_read_state', '(`is_read` = 0 AND `read_at` IS NULL) OR (`is_read` = 1 AND `read_at` IS NOT NULL)');
  }

  public async down(): Promise<void> {
    // The migration removes legacy columns and normalizes their data; reverting it
    // automatically would risk losing notification history.
  }
}
