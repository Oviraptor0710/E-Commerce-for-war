import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { RewardProof } from './reward_proof.entity';
import { RewardRule } from './reward_rule.entity';

@Entity('proof_achievements')
@Unique('uq_proof_achievements_proof_rule', ['proof_id', 'rule_id'])
@Check('chk_proof_achievements_quantity_positive', 'quantity > 0')
@Check(
  'chk_proof_achievements_confidence_range',
  'ai_confidence >= 0 AND ai_confidence <= 1',
)
@Check('chk_proof_achievements_reward_non_negative', 'reward_earned >= 0')
export class ProofAchievement {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  proof_id: string;

  @Column({ type: 'bigint' })
  rule_id: string;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'decimal', precision: 5, scale: 4 })
  ai_confidence: string;

  @Column({ type: 'decimal', precision: 20, scale: 3 })
  reward_earned: string;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => RewardProof, (proof) => proof.achievements, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'proof_id',
    foreignKeyConstraintName: 'fk_proof_achievements_proof',
  })
  proof: RewardProof;

  @ManyToOne(() => RewardRule, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'rule_id',
    foreignKeyConstraintName: 'fk_proof_achievements_rule',
  })
  rule: RewardRule;
}
