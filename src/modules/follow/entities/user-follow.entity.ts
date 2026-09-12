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

@Entity('user_follows')
@Unique('UQ_user_follows_follower_followee', ['follower_id', 'followee_id'])
@Index('IDX_user_follows_follower_id', ['follower_id'])
@Index('IDX_user_follows_followee_id', ['followee_id'])
export class UserFollow {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  follower_id: string;

  @Column({ type: 'bigint' })
  followee_id: string;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'follower_id' })
  follower: User;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'followee_id' })
  followee: User;
}
