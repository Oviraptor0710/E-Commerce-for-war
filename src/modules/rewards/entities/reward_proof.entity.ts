import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Check,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { RewardAppeal } from './reward_appeal.entity';
import { ProofAchievement } from './proof_achievement.entity';
import { AiEvaluationLog } from './ai_evaluation_log.entity';
import { RewardProofStatus } from '../enums/reward-proof-status.enum';

@Entity('reward_proofs')
@Index('idx_reward_proofs_user_created', ['user_id', 'created_at'])
@Index('idx_reward_proofs_retention', ['status', 'media_retention_until'])
@Check(
  'chk_reward_proofs_video_storage_key_required',
  'video_storage_key IS NOT NULL AND CHAR_LENGTH(video_storage_key) > 0',
)
@Check(
  'chk_reward_proofs_ai_score_range',
  'ai_score IS NULL OR (ai_score >= 0 AND ai_score <= 1)',
)
@Check(
  'chk_reward_proofs_reward_coin_non_negative',
  'reward_coin IS NULL OR reward_coin >= 0',
)
export class RewardProof {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'varchar', length: 1024 })
  video_storage_key: string;

  @Column('text', { nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  ai_score: string | null;

  @Column({ type: 'decimal', precision: 20, scale: 3, nullable: true })
  reward_coin: string | null;

  @Column({
    type: 'enum',
    enum: RewardProofStatus,
    default: RewardProofStatus.UPLOADED,
  })
  status: RewardProofStatus;

  @CreateDateColumn()
  created_at: Date;

  @Column({ type: 'bigint', nullable: true })
  user_id: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  ai_model_version: string | null;

  @Column({ type: 'datetime', nullable: true })
  ai_evaluated_at: Date | null;

  @Column({ type: 'text', nullable: true })
  rejection_reason: string | null;

  @Column({ type: 'datetime' })
  media_retention_until: Date;

  @Column({ type: 'datetime', nullable: true })
  media_deleted_at: Date | null;

  @ManyToOne(() => User, (user) => user.reward_proofs)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => RewardAppeal, (appeal) => appeal.proof)
  appeals: RewardAppeal[];

  @OneToMany(() => ProofAchievement, (achievement) => achievement.proof)
  achievements: ProofAchievement[];

  @OneToMany(() => AiEvaluationLog, (log) => log.proof)
  evaluation_logs: AiEvaluationLog[];
}
