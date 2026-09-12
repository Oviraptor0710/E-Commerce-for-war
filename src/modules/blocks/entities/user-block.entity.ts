import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('user_blocks')
@Unique('UQ_user_blocks_blocker_blocked', ['blocker_id', 'blocked_id'])
@Index('IDX_user_blocks_blocker_id', ['blocker_id'])
@Index('IDX_user_blocks_blocked_id', ['blocked_id'])
export class UserBlock {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  blocker_id: string;

  @Column({ type: 'bigint' })
  blocked_id: string;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'blocker_id' })
  blocker: User;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'blocked_id' })
  blocked: User;
}
