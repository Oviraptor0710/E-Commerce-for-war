import { MigrationInterface, QueryRunner } from 'typeorm';

export class SynchronizeConversations1784913423833
  implements MigrationInterface
{
  name = 'SynchronizeConversations1784913423833';

  public async up(q: QueryRunner): Promise<void> {
    const tableExists = async (table: string) => {
      const rows = await q.query(
        `SELECT COUNT(*) count FROM INFORMATION_SCHEMA.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
        [table],
      );
      return Number(rows[0]?.count ?? 0) > 0;
    };
    const columnExists = async (table: string, column: string) => {
      const rows = await q.query(
        `SELECT COUNT(*) count FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column],
      );
      return Number(rows[0]?.count ?? 0) > 0;
    };
    const indexExists = async (table: string, index: string) => {
      const rows = await q.query(
        `SELECT COUNT(*) count FROM INFORMATION_SCHEMA.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
        [table, index],
      );
      return Number(rows[0]?.count ?? 0) > 0;
    };
    const dropForeignKeys = async (table: string, columns: string[]) => {
      const placeholders = columns.map(() => '?').join(', ');
      const rows = await q.query(
        `SELECT DISTINCT CONSTRAINT_NAME
         FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
           AND COLUMN_NAME IN (${placeholders})
           AND REFERENCED_TABLE_NAME IS NOT NULL`,
        [table, ...columns],
      );
      for (const row of rows) {
        await q.query(
          `ALTER TABLE \`${table}\` DROP FOREIGN KEY \`${row.CONSTRAINT_NAME}\``,
        );
      }
    };

    if (
      !(await tableExists('conversations')) ||
      !(await tableExists('messages')) ||
      !(await tableExists('conversations_users_users'))
    ) {
      throw new Error(
        'Cannot synchronize conversations: a legacy chat table is missing.',
      );
    }

    const invalidConversationParticipants = await q.query(
      `SELECT COUNT(*) count FROM (
         SELECT conversation.id
         FROM conversations conversation
         LEFT JOIN conversations_users_users participant
           ON participant.conversationsId = conversation.id
         GROUP BY conversation.id
         HAVING COUNT(participant.usersId) <> 2
       ) invalid_conversations`,
    );
    if (Number(invalidConversationParticipants[0]?.count ?? 0) > 0) {
      throw new Error(
        'Cannot synchronize conversations: every legacy conversation must have exactly two participants.',
      );
    }

    const duplicatePairs = await q.query(
      `SELECT COUNT(*) count FROM (
         SELECT pair.first_user_id, pair.second_user_id
         FROM (
           SELECT conversationsId, MIN(usersId) first_user_id, MAX(usersId) second_user_id
           FROM conversations_users_users
           GROUP BY conversationsId
         ) pair
         GROUP BY pair.first_user_id, pair.second_user_id
         HAVING COUNT(*) > 1
       ) duplicate_pairs`,
    );
    if (Number(duplicatePairs[0]?.count ?? 0) > 0) {
      throw new Error(
        'Cannot synchronize conversations: duplicate direct conversations exist for the same user pair.',
      );
    }

    const invalidMessages = await q.query(
      `SELECT COUNT(*) count
       FROM messages
       WHERE conversation_id IS NULL OR sender_id IS NULL OR CHAR_LENGTH(type) > 30`,
    );
    if (Number(invalidMessages[0]?.count ?? 0) > 0) {
      throw new Error(
        'Cannot synchronize conversations: a legacy message has invalid ownership or type.',
      );
    }

    const invalidLastMessage = await q.query(
      `SELECT COUNT(*) count
       FROM conversations conversation
       LEFT JOIN messages message ON message.id = conversation.last_messasge_id
       WHERE conversation.last_messasge_id IS NOT NULL AND message.id IS NULL`,
    );
    if (Number(invalidLastMessage[0]?.count ?? 0) > 0) {
      throw new Error(
        'Cannot synchronize conversations: a last-message reference is invalid.',
      );
    }

    await dropForeignKeys('messages', [
      'conversation_id',
      'sender_id',
      'receiver_id',
    ]);
    await dropForeignKeys('conversations_users_users', [
      'conversationsId',
      'usersId',
    ]);

    await q.query(
      `ALTER TABLE conversations
       ADD COLUMN last_message_id BIGINT NULL,
       ADD COLUMN last_message_preview VARCHAR(500) NULL,
       ADD COLUMN last_message_sender_id INT NULL,
       ADD COLUMN last_message_type VARCHAR(30) NULL,
       ADD COLUMN last_message_at DATETIME(6) NULL,
       ADD COLUMN created_at DATETIME(6) NULL,
       ADD COLUMN updated_at DATETIME(6) NULL`,
    );

    await q.query(
      `UPDATE conversations conversation
       LEFT JOIN messages message ON message.id = conversation.last_messasge_id
       SET conversation.last_message_id = message.id,
           conversation.last_message_preview = CASE
             WHEN message.type = 'image' THEN '[Hình ảnh]'
             WHEN message.type = 'video' THEN '[Video]'
             WHEN message.type = 'file' THEN '[Tệp]'
             WHEN message.type IN ('product', 'product_id') THEN '[Sản phẩm]'
             ELSE LEFT(message.content, 500)
           END,
           conversation.last_message_sender_id = message.sender_id,
           conversation.last_message_type = CASE
             WHEN message.type = 'product_id' THEN 'product'
             ELSE message.type
           END,
           conversation.last_message_at = CASE
             WHEN message.created_at IS NULL OR message.created_at <= 0 THEN NULL
             ELSE FROM_UNIXTIME(message.created_at)
           END,
           conversation.created_at = COALESCE(
             (
               SELECT FROM_UNIXTIME(MIN(first_message.created_at))
               FROM messages first_message
               WHERE first_message.conversation_id = conversation.id
                 AND first_message.created_at > 0
             ),
             FROM_UNIXTIME(NULLIF(conversation.time_last_update, 0)),
             CURRENT_TIMESTAMP(6)
           ),
           conversation.updated_at = COALESCE(
             FROM_UNIXTIME(NULLIF(conversation.time_last_update, 0)),
             CURRENT_TIMESTAMP(6)
           )`,
    );

    await q.query(
      `ALTER TABLE messages
       ADD COLUMN client_message_id VARCHAR(100) NULL,
       ADD COLUMN created_at_v2 DATETIME(6) NULL`,
    );
    await q.query(
      `UPDATE messages
       SET client_message_id = CONCAT('legacy:', id),
           created_at_v2 = CASE
             WHEN created_at IS NULL OR created_at <= 0 THEN CURRENT_TIMESTAMP(6)
             ELSE FROM_UNIXTIME(created_at)
           END,
           type = CASE WHEN type = 'product_id' THEN 'product' ELSE type END`,
    );
    await q.query('ALTER TABLE messages DROP COLUMN `created_at`');
    await q.query(
      'ALTER TABLE messages CHANGE COLUMN `created_at_v2` `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)',
    );

    await q.query(
      `ALTER TABLE conversations
       MODIFY id BIGINT NOT NULL AUTO_INCREMENT,
       MODIFY created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
       MODIFY updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)`,
    );
    await q.query(
      `ALTER TABLE messages
       MODIFY id BIGINT NOT NULL AUTO_INCREMENT,
       MODIFY conversation_id BIGINT NOT NULL,
       MODIFY sender_id INT NOT NULL,
       MODIFY client_message_id VARCHAR(100) NOT NULL,
       MODIFY content TEXT NULL,
       MODIFY type VARCHAR(30) NOT NULL`,
    );

    await q.query(
      `CREATE TABLE conversation_participants (
         conversation_id BIGINT NOT NULL,
         user_id INT NOT NULL,
         last_read_message_id BIGINT NULL,
         last_read_at DATETIME(6) NULL,
         unread_count INT NOT NULL DEFAULT 0,
         PRIMARY KEY (conversation_id, user_id),
         INDEX idx_conversation_participants_user (user_id, conversation_id)
       ) ENGINE=InnoDB`,
    );
    await q.query(
      `INSERT INTO conversation_participants (
         conversation_id,
         user_id,
         last_read_message_id,
         last_read_at,
         unread_count
       )
       SELECT legacy.conversationsId,
              legacy.usersId,
              (
                SELECT read_message.id
                FROM messages read_message
                WHERE read_message.conversation_id = legacy.conversationsId
                  AND conversation.time_last_seen > 0
                  AND read_message.created_at <= FROM_UNIXTIME(conversation.time_last_seen)
                ORDER BY read_message.id DESC
                LIMIT 1
              ),
              CASE
                WHEN conversation.time_last_seen > 0
                  THEN FROM_UNIXTIME(conversation.time_last_seen)
                ELSE NULL
              END,
              (
                SELECT COUNT(*)
                FROM messages unread_message
                WHERE unread_message.conversation_id = legacy.conversationsId
                  AND unread_message.sender_id <> legacy.usersId
                  AND (
                    conversation.time_last_seen IS NULL
                    OR conversation.time_last_seen <= 0
                    OR unread_message.created_at > FROM_UNIXTIME(conversation.time_last_seen)
                  )
              )
       FROM conversations_users_users legacy
       INNER JOIN conversations conversation
         ON conversation.id = legacy.conversationsId`,
    );

    await q.query('DROP TABLE conversations_users_users');
    if (await columnExists('messages', 'receiver_id')) {
      await q.query('ALTER TABLE messages DROP COLUMN receiver_id');
    }
    await q.query(
      `ALTER TABLE conversations
       DROP COLUMN time_last_update,
       DROP COLUMN time_last_seen,
       DROP COLUMN last_messasge_id`,
    );

    if (!(await indexExists('conversations', 'uq_conversations_last_message_id'))) {
      await q.query(
        'ALTER TABLE conversations ADD UNIQUE INDEX uq_conversations_last_message_id (last_message_id)',
      );
    }
    if (!(await indexExists('conversations', 'idx_conversations_last_message_at'))) {
      await q.query(
        'ALTER TABLE conversations ADD INDEX idx_conversations_last_message_at (last_message_at)',
      );
    }
    if (!(await indexExists('messages', 'idx_messages_conversation_time'))) {
      await q.query(
        'ALTER TABLE messages ADD INDEX idx_messages_conversation_time (conversation_id, created_at)',
      );
    }
    if (!(await indexExists('messages', 'uq_messages_sender_client_id'))) {
      await q.query(
        'ALTER TABLE messages ADD UNIQUE INDEX uq_messages_sender_client_id (sender_id, client_message_id)',
      );
    }

    await q.query(
      `ALTER TABLE conversation_participants
       ADD CONSTRAINT chk_conversation_participants_unread_non_negative
         CHECK (unread_count >= 0)`,
    );
    await q.query(
      `ALTER TABLE messages
       ADD CONSTRAINT fk_messages_conversation
         FOREIGN KEY (conversation_id) REFERENCES conversations(id)
         ON DELETE CASCADE ON UPDATE NO ACTION,
       ADD CONSTRAINT fk_messages_sender
         FOREIGN KEY (sender_id) REFERENCES users(id)
         ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await q.query(
      `ALTER TABLE conversations
       ADD CONSTRAINT fk_conversations_last_message
         FOREIGN KEY (last_message_id) REFERENCES messages(id)
         ON DELETE SET NULL ON UPDATE NO ACTION,
       ADD CONSTRAINT fk_conversations_last_message_sender
         FOREIGN KEY (last_message_sender_id) REFERENCES users(id)
         ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await q.query(
      `ALTER TABLE conversation_participants
       ADD CONSTRAINT fk_conversation_participants_conversation
         FOREIGN KEY (conversation_id) REFERENCES conversations(id)
         ON DELETE CASCADE ON UPDATE NO ACTION,
       ADD CONSTRAINT fk_conversation_participants_user
         FOREIGN KEY (user_id) REFERENCES users(id)
         ON DELETE RESTRICT ON UPDATE NO ACTION,
       ADD CONSTRAINT fk_conversation_participants_last_read_message
         FOREIGN KEY (last_read_message_id) REFERENCES messages(id)
         ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(): Promise<void> {
    // Legacy time_last_seen was shared by both participants and cannot be
    // reconstructed from per-user read state without losing information.
  }
}
