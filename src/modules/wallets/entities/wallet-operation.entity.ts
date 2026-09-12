import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { WalletOperationStatus } from '../enums/wallet-operation-status.enum';
import { WalletOperationType } from '../enums/wallet-operation-type.enum';
import { WalletReferenceType } from '../enums/wallet-reference-type.enum';

@Entity('wallet_operations')
@Index('idx_wallet_operations_reference', ['reference_type', 'reference_id'])
@Index('UQ_wallet_operations_idempotency_key', ['idempotency_key'], {
  unique: true,
})
export class WalletOperation {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'enum', enum: WalletOperationType })
  type: WalletOperationType;

  @Column({ type: 'enum', enum: WalletReferenceType })
  reference_type: WalletReferenceType;

  @Column({ type: 'bigint', nullable: true })
  reference_id: string | null;

  @Column({ type: 'varchar', length: 150 })
  idempotency_key: string;

  @Column({
    type: 'enum',
    enum: WalletOperationStatus,
    default: WalletOperationStatus.PENDING,
  })
  status: WalletOperationStatus;

  @Column({ type: 'bigint', nullable: true })
  reverses_operation_id: string | null;

  @Column({ type: 'varchar', length: 64 })
  request_hash: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn()
  created_at: Date;

  @Column({ type: 'datetime', nullable: true })
  completed_at: Date | null;

  @ManyToOne(() => WalletOperation, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'reverses_operation_id',
    foreignKeyConstraintName: 'fk_wallet_operations_reversal',
  })
  reverses_operation: WalletOperation | null;
}
