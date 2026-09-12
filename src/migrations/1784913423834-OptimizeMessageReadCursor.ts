import { MigrationInterface, QueryRunner } from 'typeorm';

export class OptimizeMessageReadCursor1784913423834 implements MigrationInterface {
  name = 'OptimizeMessageReadCursor1784913423834';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE INDEX `idx_messages_conversation_id` ON `messages` (`conversation_id`, `id`)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX `idx_messages_conversation_id` ON `messages`',
    );
  }
}
