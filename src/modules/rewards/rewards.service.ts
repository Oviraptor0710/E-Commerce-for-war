import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { RewardProof } from './entities/reward_proof.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { RewardAppeal } from './entities/reward_appeal.entity';
import { GetRewardHistoryDto } from './dto/get-reward-history.dto';
import {
  APP_RESPONSE,
  buildResponse,
} from '../../common/constants/response.constants';
import { CreateRewardAppealDto } from './dto/create-reward-appeal.dto';
import OpenAI from 'openai';
import { SecretConfig } from '../../config/secret';
import { AddRewardProofDto } from './dto/add-reward-proof.dto';
import { WalletLedgerService } from '../wallets/wallet-ledger.service';
import { WalletBalanceBucket } from '../wallets/enums/wallet-balance-bucket.enum';
import { WalletEntryDirection } from '../wallets/enums/wallet-entry-direction.enum';
import { WalletOperationType } from '../wallets/enums/wallet-operation-type.enum';
import { WalletReferenceType } from '../wallets/enums/wallet-reference-type.enum';
import { GetRewardProofDto } from './dto/get-reward-proof.dto';
import { GoogleGenAI } from '@google/genai';
import { RewardProofStatus } from './enums/reward-proof-status.enum';
import { RewardAppealStatus } from './enums/reward-appeal-status.enum';

import * as dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({});
@Injectable()
export class RewardsService {
  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(RewardProof)
    private readonly rewardProofRepo: Repository<RewardProof>,

    @InjectRepository(RewardAppeal)
    private readonly rewardAppealRepo: Repository<RewardAppeal>,

    private readonly walletLedgerService: WalletLedgerService,
  ) {}

  async getRewardHistory(
    currentUserId: string,
    getRewardHistoryDto: GetRewardHistoryDto,
  ) {
    const skip = (getRewardHistoryDto.index - 1) * getRewardHistoryDto.count;
    let [proofs, _] = await this.rewardProofRepo.findAndCount({
      where: {
        user: { id: currentUserId },
      },
      relations: ['user', 'appeals'],
      order: {
        created_at: 'DESC',
      },
      skip: skip,
      take: getRewardHistoryDto.count,
    });
    return buildResponse(APP_RESPONSE.OK, proofs);
  }

  async createRewardAppeal(currentUserId: string, body: CreateRewardAppealDto) {
    let reward = await this.rewardProofRepo.findOne({
      where: { id: body.reward_id },
    });
    if (!reward) {
      return {
        ...APP_RESPONSE.PARAMETER_VALUE_INVALID,
        data: null,
      };
    }
    let appeal = await this.rewardAppealRepo.create({
      reason: body.reason,
      status: RewardAppealStatus.PENDING,
      proof: { id: reward.id },
      user: { id: currentUserId },
    });
    return {
      ...APP_RESPONSE.OK,
      data: await this.rewardAppealRepo.save(appeal),
    };
  }

  async callApiOpenAi(input_text: string, input_url: string) {
    try {
      const client = new OpenAI({
        apiKey: SecretConfig.openai.api_key,
      });

      // const models = await client.models.list();

      // for (const model of models.data) {
      //   console.log(model.id);
      // }

      const response = await client.responses.create({
        model: 'gpt-5.5',
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: input_text,
              },
              {
                type: 'input_image',
                image_url: input_url,
                detail: 'auto',
              },
            ],
          },
        ],
      });

      return response.output_text;
    } catch (err: any) {
      console.log(`Error with prompt ${input_text} ${input_url}: ${err}`);
      return `Error with prompt ${input_text} ${input_url}: ${err.toString()}`;
    }
  }

  async fetchImageAndConvertToBase64(url: string) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Không thể tải ảnh. Status: ${response.status}`);
      }

      const mimeType = response.headers.get('content-type') || 'image/jpeg';

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64Data = buffer.toString('base64');

      return { mimeType, base64Data };
    } catch (error) {
      console.error('Lỗi khi tải ảnh:', error);
      throw error;
    }
  }

  async analyzeImageFromUrl(prompt: string, imageUrl: string) {
    try {
      console.log('1. Đang tải ảnh từ URL về bộ nhớ...');
      const { mimeType, base64Data } =
        await this.fetchImageAndConvertToBase64(imageUrl);

      console.log('2. Đang gửi ảnh và câu hỏi cho Gemini...');
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          prompt,
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          },
        ],
      });

      console.log('\n--- Đánh giá của Gemini ---');
      console.log(response.text);
      console.log('---------------------------\n');

      return response.text;
    } catch (err: any) {
      console.log(`Error with prompt ${prompt} ${imageUrl}: ${err}`);
      return `Error with prompt ${prompt} ${imageUrl}: ${err.toString()}`;
    }
  }

  async addRewardProof(currentUserId: string, body: AddRewardProofDto) {
    if (!body.video_url) {
      return {
        ...APP_RESPONSE.PARAMETER_VALUE_INVALID,
        data: null,
      };
    }

    let proof = this.rewardProofRepo.create({
      video_storage_key: body.video_url,
      description: body.description,
      ai_score: null,
      reward_coin: null,
      status: RewardProofStatus.PROCESSING,
      media_retention_until: this.addOneYear(new Date()),
      user: { id: currentUserId },
    });

    let proof_saved = await this.rewardProofRepo.save(proof);

    let input_text = `trong video trên có phải có ${body.description} không? hãy xác định rõ cả số lượng trong câu hỏi, nếu đúng trả lời 1, nếu sai trả lời 0,
      không trả lời thêm bất cứ từ nào ngoài 0 hoặc 1, cứ đưa ra câu trả lời theo cảm tính của bạn`;
    let result_prompt = await this.analyzeImageFromUrl(input_text, body.video_url);
    let ai_score: string | null = null;
    let reward_coin: string | null = null;
    if (result_prompt == '0') {
      ai_score = '0.0000';
      reward_coin = '0.000';
    } else if (result_prompt == '1') {
      ai_score = '1.0000';
      reward_coin = '1000000.000';
    } else {
      await this.rewardProofRepo.update(proof_saved.id, {
        status: RewardProofStatus.FAILED,
        rejection_reason: 'AI returned an invalid result.',
      });
      return {
        ...APP_RESPONSE.OK,
        data: {
          proof: proof_saved,
          error: result_prompt,
        },
      };
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(RewardProof).update(proof_saved.id, {
        ai_score,
        reward_coin,
        status:
          ai_score === '0.0000'
            ? RewardProofStatus.REJECTED
            : RewardProofStatus.REWARDED,
        ai_evaluated_at: new Date(),
      });

      if (ai_score === '1.0000' && reward_coin !== null) {
        await this.walletLedgerService.applyOperation(manager, {
          type: WalletOperationType.REWARD_CREDIT,
          referenceType: WalletReferenceType.REWARD_PROOF,
          referenceId: proof_saved.id,
          idempotencyKey: `REWARD_PROOF:${proof_saved.id}`,
          description: `Reward for proof #${proof_saved.id}`,
          entries: [
            {
              userId: currentUserId,
              bucket: WalletBalanceBucket.AVAILABLE,
              direction: WalletEntryDirection.CREDIT,
              amount: reward_coin,
            },
          ],
        });
      }
    });

    return {
      ...APP_RESPONSE.OK,
      data: {
        proof: {
          ...proof_saved,
          ai_score: ai_score,
          reward_coin: reward_coin,
        },
      },
    };
  }

  private addOneYear(date: Date): Date {
    const result = new Date(date);
    result.setFullYear(result.getFullYear() + 1);
    return result;
  }

  async getRewardProof(currentUserId: string, body: GetRewardProofDto) {
    let proof = await this.rewardProofRepo.findOne({
      where: { id: body.reward_id },
      relations: ['user', 'appeals'],
    });
    if (!proof || proof.user.id != currentUserId) {
      return {
        ...APP_RESPONSE.PARAMETER_VALUE_INVALID,
        data: null,
      };
    }
    return {
      ...APP_RESPONSE.OK,
      data: proof,
    };
  }
}
