import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Transaction } from './transaction.entity';
import { WalletEntry } from './wallet-entry.entity';

@Entity('wallets')
export class Wallet {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  user_id: string;

  @Column('decimal', { precision: 20, scale: 3, default: '0.000' })
  available_balance: string;

  @Column('decimal', { precision: 20, scale: 3, default: '0.000' })
  pending_balance: string;

  @Column({ type: 'varchar', length: 30, default: 'active' })
  status: string;

  @Column({ type: 'int', default: 0 })
  version: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToOne(() => User, (user) => user.wallet)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => Transaction, (transaction) => transaction.wallet)
  transactions: Transaction[];

  @OneToMany(() => WalletEntry, (entry) => entry.wallet)
  entries: WalletEntry[];
}
