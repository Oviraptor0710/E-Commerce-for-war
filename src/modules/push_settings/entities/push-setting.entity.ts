import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('push_settings')
export class PushSetting {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Index({ unique: true })
  @Column({ type: 'bigint' })
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'tinyint', default: 1 })
  like: number;

  @Column({ type: 'tinyint', default: 1 })
  comment: number;

  @Column({ type: 'tinyint', default: 1 })
  transaction: number;

  @Column({ type: 'tinyint', default: 1 })
  announcement: number;

  @Column({ type: 'tinyint', default: 1 })
  sound_on: number;

  @Column({ type: 'varchar', length: 50, default: 'default' })
  sound_default: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
