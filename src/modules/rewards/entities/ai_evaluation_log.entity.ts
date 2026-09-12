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
import { RewardProof } from './reward_proof.entity';
import { AiEvaluationStatus } from '../enums/ai-evaluation-status.enum';

@Entity('ai_evaluation_logs')
@Unique('uq_ai_evaluation_logs_proof_attempt', ['proof_id', 'attempt_no'])
@Index('idx_ai_evaluation_logs_proof_created', ['proof_id', 'created_at'])
export class AiEvaluationLog {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  proof_id: string;

  @Column({ type: 'int' })
  attempt_no: number;

  @Column({ type: 'varchar', length: 150 })
  model_name: string;

  @Column({ type: 'varchar', length: 100 })
  model_version: string;

  @Column({ type: 'json', nullable: true })
  input_data: Record<string, unknown> | null;

  @Column({ type: 'json', nullable: true })
  output_data: Record<string, unknown> | null;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  score: string | null;

  @Column({ type: 'int', nullable: true })
  processing_time_ms: number | null;

  @Column({ type: 'enum', enum: AiEvaluationStatus })
  status: AiEvaluationStatus;

  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => RewardProof, (proof) => proof.evaluation_logs, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'proof_id',
    foreignKeyConstraintName: 'fk_ai_evaluation_logs_proof',
  })
  proof: RewardProof;
}
