import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlignOrderTimelineForeignKey1784913423840
  implements MigrationInterface
{
  name = 'AlignOrderTimelineForeignKey1784913423840';

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

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await this.hasTable(queryRunner, 'order_timelines'))) return;

    if (await this.hasConstraint(queryRunner, 'fk_order_timelines_order')) {
      await queryRunner.query(
        'ALTER TABLE `order_timelines` DROP FOREIGN KEY `fk_order_timelines_order`',
      );
    }

    await queryRunner.query(
      `ALTER TABLE \`order_timelines\`
       ADD CONSTRAINT \`fk_order_timelines_order\`
       FOREIGN KEY (\`order_id\`) REFERENCES \`orders\`(\`id\`)
       ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await this.hasTable(queryRunner, 'order_timelines'))) return;

    if (await this.hasConstraint(queryRunner, 'fk_order_timelines_order')) {
      await queryRunner.query(
        'ALTER TABLE `order_timelines` DROP FOREIGN KEY `fk_order_timelines_order`',
      );
    }

    await queryRunner.query(
      `ALTER TABLE \`order_timelines\`
       ADD CONSTRAINT \`fk_order_timelines_order\`
       FOREIGN KEY (\`order_id\`) REFERENCES \`orders\`(\`id\`)
       ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
