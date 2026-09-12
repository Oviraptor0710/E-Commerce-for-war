import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RewardsController } from './rewards.controller';
import { RewardsService } from './rewards.service';
import { User } from '../users/entities/user.entity';
import { RewardProof } from './entities/reward_proof.entity';
import { RewardAppeal } from './entities/reward_appeal.entity';
import { RewardRule } from './entities/reward_rule.entity';
import { WalletsModule } from '../wallets/wallets.module';
import { ProofAchievement } from './entities/proof_achievement.entity';
import { AiEvaluationLog } from './entities/ai_evaluation_log.entity';

@Module({
  imports: [
    WalletsModule,
    TypeOrmModule.forFeature([
      User,
      RewardProof,
      RewardAppeal,
      RewardRule,
      ProofAchievement,
      AiEvaluationLog,
    ]),
  ],
  controllers: [RewardsController],
  providers: [RewardsService],
  exports: [RewardsService, TypeOrmModule],
})
export class RewardsModule {}
