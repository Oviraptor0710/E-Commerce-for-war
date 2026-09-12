import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RewardAppealStatus } from '../enums/reward-appeal-status.enum';
import { RewardProofStatus } from '../enums/reward-proof-status.enum';

export class RewardAppealResponseDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String, nullable: true }) reason!: string | null;
  @ApiProperty({ enum: RewardAppealStatus }) status!: RewardAppealStatus;
  @ApiProperty({ type: String, nullable: true }) user_id!: string | null;
  @ApiProperty({ type: String }) proof_id!: string;
}

export class RewardProofResponseDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) video_storage_key!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty({ type: String, nullable: true, description: 'Điểm AI, DECIMAL(5,4).' }) ai_score!: string | null;
  @ApiProperty({ type: String, nullable: true, description: 'Điểm thưởng, DECIMAL(20,3).' }) reward_coin!: string | null;
  @ApiProperty({ enum: RewardProofStatus }) status!: RewardProofStatus;
  @ApiProperty({ type: String, format: 'date-time' }) created_at!: string;
  @ApiProperty({ type: String, nullable: true }) user_id!: string | null;
  @ApiProperty({ type: String, nullable: true }) ai_model_version!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) ai_evaluated_at!: string | null;
  @ApiProperty({ type: String, nullable: true }) rejection_reason!: string | null;
  @ApiProperty({ type: String, format: 'date-time' }) media_retention_until!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) media_deleted_at!: string | null;
  @ApiPropertyOptional({ type: () => [RewardAppealResponseDto] }) appeals?: RewardAppealResponseDto[];
}

export class AddRewardProofResponseDataDto {
  @ApiProperty({ type: () => RewardProofResponseDto }) proof!: RewardProofResponseDto;
  @ApiPropertyOptional({ type: String }) error?: string;
}
