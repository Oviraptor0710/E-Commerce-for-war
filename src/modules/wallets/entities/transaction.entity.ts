import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Wallet } from './wallet.entity';

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  wallet_id: string;

  @Column({ nullable: true })
  type: string;

  @Column('decimal', { nullable: true })
  amount: string;

  @Column({ nullable: true })
  status: string;

  @Column('text', { nullable: true })
  description: string;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => Wallet, (wallet) => wallet.transactions)
  @JoinColumn({
    name: 'wallet_id',
    foreignKeyConstraintName: 'fk_transactions_wallet',
  })
  wallet: Wallet;
}
