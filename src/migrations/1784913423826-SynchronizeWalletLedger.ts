import { MigrationInterface, QueryRunner } from 'typeorm';

export class SynchronizeWalletLedger1784913423826
  implements MigrationInterface
{
  name = 'SynchronizeWalletLedger1784913423826';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const wallets = await queryRunner.getTable('wallets');
    if (!wallets) {
      throw new Error('Cannot synchronize wallet ledger: wallets table does not exist.');
    }

    const hasColumn = (name: string) => Boolean(wallets.findColumnByName(name));

    if (hasColumn('balance') && !hasColumn('available_balance')) {
      await queryRunner.query(`
        ALTER TABLE wallets
          CHANGE COLUMN balance available_balance DECIMAL(20,3) NOT NULL DEFAULT '0.000'
      `);
    } else if (hasColumn('available_balance')) {
      await queryRunner.query(`
        ALTER TABLE wallets
          MODIFY COLUMN available_balance DECIMAL(20,3) NOT NULL DEFAULT '0.000'
      `);
    }

    if (hasColumn('pending_balance')) {
      await queryRunner.query(`
        ALTER TABLE wallets
          MODIFY COLUMN pending_balance DECIMAL(20,3) NOT NULL DEFAULT '0.000'
      `);
    }

    if (!hasColumn('status')) {
      await queryRunner.query(`
        ALTER TABLE wallets
          ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT 'active' AFTER pending_balance
      `);
    }

    if (!hasColumn('version')) {
      await queryRunner.query(`
        ALTER TABLE wallets
          ADD COLUMN version INT NOT NULL DEFAULT 0 AFTER status
      `);
    }

    if (!hasColumn('created_at')) {
      await queryRunner.query(`
        ALTER TABLE wallets
          ADD COLUMN created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
      `);
    }

    if (!hasColumn('updated_at')) {
      await queryRunner.query(`
        ALTER TABLE wallets
          ADD COLUMN updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
            ON UPDATE CURRENT_TIMESTAMP(6)
      `);
    }

    if (!(await queryRunner.hasTable('wallet_operations'))) {
      await queryRunner.query(`
        CREATE TABLE wallet_operations (
          id BIGINT NOT NULL AUTO_INCREMENT,
          type ENUM(
            'development_credit',
            'reward_credit',
            'order_payment',
            'seller_points_release',
            'order_refund',
            'adjustment',
            'reversal'
          ) NOT NULL,
          reference_type ENUM(
            'development',
            'reward_proof',
            'order',
            'refund',
            'admin_action'
          ) NOT NULL,
          reference_id BIGINT NULL,
          idempotency_key VARCHAR(150) NOT NULL,
          status ENUM('pending', 'completed', 'failed', 'reversed') NOT NULL DEFAULT 'pending',
          reverses_operation_id BIGINT NULL,
          request_hash VARCHAR(64) NOT NULL,
          description TEXT NULL,
          metadata JSON NULL,
          created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          completed_at DATETIME(6) NULL,
          PRIMARY KEY (id),
          UNIQUE INDEX UQ_wallet_operations_idempotency_key (idempotency_key),
          INDEX idx_wallet_operations_reference (reference_type, reference_id),
          CONSTRAINT chk_wallet_operations_reversal_reference
            CHECK (type <> 'reversal' OR reverses_operation_id IS NOT NULL),
          CONSTRAINT fk_wallet_operations_reversal
            FOREIGN KEY (reverses_operation_id) REFERENCES wallet_operations(id)
            ON DELETE RESTRICT ON UPDATE NO ACTION
        ) ENGINE=InnoDB
      `);
    }

    if (!(await queryRunner.hasTable('wallet_entries'))) {
      await queryRunner.query(`
        CREATE TABLE wallet_entries (
          id BIGINT NOT NULL AUTO_INCREMENT,
          operation_id BIGINT NOT NULL,
          wallet_id INT NOT NULL,
          bucket ENUM('available', 'pending') NOT NULL,
          direction ENUM('credit', 'debit') NOT NULL,
          amount DECIMAL(20,3) NOT NULL,
          balance_before DECIMAL(20,3) NOT NULL,
          balance_after DECIMAL(20,3) NOT NULL,
          created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          PRIMARY KEY (id),
          UNIQUE INDEX uq_wallet_entries_operation_wallet_bucket (operation_id, wallet_id, bucket),
          INDEX idx_wallet_entries_history (wallet_id, created_at),
          CONSTRAINT chk_wallet_entries_amount_positive CHECK (amount > 0),
          CONSTRAINT chk_wallet_entries_before_non_negative CHECK (balance_before >= 0),
          CONSTRAINT chk_wallet_entries_after_non_negative CHECK (balance_after >= 0),
          CONSTRAINT chk_wallet_entries_balance_equation CHECK (
            (direction = 'credit' AND balance_after = balance_before + amount)
            OR (direction = 'debit' AND balance_after = balance_before - amount)
          ),
          CONSTRAINT fk_wallet_entries_operation
            FOREIGN KEY (operation_id) REFERENCES wallet_operations(id)
            ON DELETE RESTRICT ON UPDATE NO ACTION,
          CONSTRAINT fk_wallet_entries_wallet
            FOREIGN KEY (wallet_id) REFERENCES wallets(id)
            ON DELETE RESTRICT ON UPDATE NO ACTION
        ) ENGINE=InnoDB
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('wallet_entries')) {
      await queryRunner.query('DROP TABLE wallet_entries');
    }

    if (await queryRunner.hasTable('wallet_operations')) {
      await queryRunner.query('DROP TABLE wallet_operations');
    }

    const wallets = await queryRunner.getTable('wallets');
    if (!wallets) return;

    const hasColumn = (name: string) => Boolean(wallets.findColumnByName(name));
    const removableColumns = ['updated_at', 'created_at', 'version', 'status'];
    for (const column of removableColumns) {
      if (hasColumn(column)) {
        await queryRunner.query(`ALTER TABLE wallets DROP COLUMN ${column}`);
      }
    }

    if (hasColumn('available_balance') && !hasColumn('balance')) {
      await queryRunner.query(`
        ALTER TABLE wallets
          CHANGE COLUMN available_balance balance DECIMAL(20,3) NOT NULL DEFAULT '0.000'
      `);
    }
  }
}
