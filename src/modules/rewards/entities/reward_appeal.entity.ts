import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { RewardProof } from './reward_proof.entity';
import { User } from '../../users/entities/user.entity';
import { RewardAppealStatus } from '../enums/reward-appeal-status.enum';

@Entity('reward_appeals')
export class RewardAppeal {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column('text', { nullable: true })
  reason: string;

  @Column({
    type: 'enum',
    enum: RewardAppealStatus,
    default: RewardAppealStatus.PENDING,
  })
  status: RewardAppealStatus;

  @Column({ type: 'bigint', nullable: true })
  user_id: string | null;

  @Column({ type: 'bigint' })
  proof_id: string;

  @ManyToOne(() => RewardProof, (bp) => bp.appeals, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'proof_id',
    foreignKeyConstraintName: 'fk_reward_appeals_proof',
  })
  proof: RewardProof;

  @ManyToOne(() => User, (user) => user.appeals)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
