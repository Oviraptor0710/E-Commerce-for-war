import { Check, Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('reward_rules')
@Index('uq_reward_rules_achievement_type', ['achievement_type'], {
  unique: true,
})
@Check('chk_reward_rules_reward_coin_non_negative', 'reward_coin >= 0')
@Check(
  'chk_reward_rules_min_ai_score_range',
  'min_ai_score IS NULL OR (min_ai_score >= 0 AND min_ai_score <= 1)',
)
export class RewardRule {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'varchar', length: 100 })
  achievement_type: string;

  @Column({ type: 'varchar', length: 255, default: 'Unnamed reward' })
  achievement_name: string;

  @Column({
    type: 'decimal',
    precision: 20,
    scale: 3,
    default: '0.000',
  })
  reward_coin: string;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  min_ai_score: string | null;

  @Column({ type: 'decimal', precision: 20, scale: 3, nullable: true })
  max_reward_per_day: string | null;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'varchar', length: 512, nullable: true })
  icon_url: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;
}
