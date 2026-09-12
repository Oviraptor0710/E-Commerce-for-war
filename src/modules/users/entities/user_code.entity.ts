import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('user_codes')
export class UserCode {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  user_id: string;

  @Column({ nullable: true })
  code: string;

  @Column({ type: 'timestamp', nullable: true })
  expired_at: Date;

  @ManyToOne(() => User, (user) => user.user_codes)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
