import { MigrationInterface, QueryRunner } from 'typeorm';

export class OptimizeCommentEligibility1784913423845 implements MigrationInterface {
  name = 'OptimizeCommentEligibility1784913423845';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE INDEX `idx_orders_comment_eligibility` ON `orders` (`buyer_id`, `seller_id`, `status`, `id`)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX `idx_orders_comment_eligibility` ON `orders`',
    );
  }
}
