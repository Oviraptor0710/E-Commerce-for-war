import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Wallet } from './wallet.entity';
import { WalletOperation } from './wallet-operation.entity';
import { WalletBalanceBucket } from '../enums/wallet-balance-bucket.enum';
import { WalletEntryDirection } from '../enums/wallet-entry-direction.enum';

@Entity('wallet_entries')
@Index(
  'uq_wallet_entries_operation_wallet_bucket',
  ['operation_id', 'wallet_id', 'bucket'],
  { unique: true },
)
@Index('idx_wallet_entries_history', ['wallet_id', 'created_at'])
@Check('chk_wallet_entries_amount_positive', 'amount > 0')
@Check('chk_wallet_entries_before_non_negative', 'balance_before >= 0')
@Check('chk_wallet_entries_after_non_negative', 'balance_after >= 0')
@Check(
  'chk_wallet_entries_balance_equation',
  "(direction = 'credit' AND balance_after = balance_before + amount) OR (direction = 'debit' AND balance_after = balance_before - amount)",
)
export class WalletEntry {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  operation_id: string;

  @Column({ type: 'bigint' })
  wallet_id: string;

  @Column({ type: 'enum', enum: WalletBalanceBucket })
  bucket: WalletBalanceBucket;

  @Column({ type: 'enum', enum: WalletEntryDirection })
  direction: WalletEntryDirection;

  @Column({ type: 'decimal', precision: 20, scale: 3 })
  amount: string;

  @Column({ type: 'decimal', precision: 20, scale: 3 })
  balance_before: string;

  @Column({ type: 'decimal', precision: 20, scale: 3 })
  balance_after: string;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => WalletOperation, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'operation_id',
    foreignKeyConstraintName: 'fk_wallet_entries_operation',
  })
  operation: WalletOperation;

  @ManyToOne(() => Wallet, (wallet) => wallet.entries, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'wallet_id',
    foreignKeyConstraintName: 'fk_wallet_entries_wallet',
  })
  wallet: Wallet;
}
