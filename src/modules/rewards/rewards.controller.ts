import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { RewardsService } from './rewards.service';
import { AuthGuard } from '../../common/auth/guards/auth.guard';
import type { AuthenticatedRequest } from '../../types/auth.type';
import { GetRewardHistoryDto } from './dto/get-reward-history.dto';
import { APP_RESPONSE } from '../constants/response.constants';
import { buildResponse } from '../constants/response.constants';
import { CreateRewardAppealDto } from './dto/create-reward-appeal.dto';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AddRewardProofDto } from './dto/add-reward-proof.dto';
import { GetRewardProofDto } from './dto/get-reward-proof.dto';
import { ApiDataResponse } from '../../common/swagger/api-data-response.decorator';
import {
  AddRewardProofResponseDataDto,
  RewardAppealResponseDto,
  RewardProofResponseDto,
} from './dto/reward-response.dto';

@ApiBearerAuth('JWT-auth')
@Controller('rewards')
export class RewardsController {
  constructor(private readonly rewardsService: RewardsService) {}

  @Post('add_reward_proof')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  @ApiDataResponse({ type: AddRewardProofResponseDataDto })
  async add_reward_proof(
    @Req() req: AuthenticatedRequest,
    @Body() body: AddRewardProofDto,
  ) {
    try {
      const currentUserId =
        req.user?.id ?? req.user?.userId ?? req.user?.sub ?? '';

      return await this.rewardsService.addRewardProof(currentUserId, body);
    } catch (error: unknown) {
      console.error(error);
      return buildResponse(APP_RESPONSE.UNKNOWN_ERROR, null);
    }
  }

  @Post('get_reward_proof')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  @ApiDataResponse({ type: RewardProofResponseDto })
  async get_reward_proof(
    @Req() req: AuthenticatedRequest,
    @Body() body: GetRewardProofDto,
  ) {
    try {
      const currentUserId =
        req.user?.id ?? req.user?.userId ?? req.user?.sub ?? '';

      return await this.rewardsService.getRewardProof(currentUserId, body);
    } catch (error: unknown) {
      console.error(error);
      return buildResponse(APP_RESPONSE.UNKNOWN_ERROR, null);
    }
  }

  @Post('get_reward_history')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  @ApiDataResponse({ type: RewardProofResponseDto, isArray: true })
  async get_reward_history(
    @Req() req: AuthenticatedRequest,
    @Body() body: GetRewardHistoryDto,
  ) {
    try {
      const currentUserId =
        req.user?.id ?? req.user?.userId ?? req.user?.sub ?? '';

      return await this.rewardsService.getRewardHistory(currentUserId, body);
    } catch (error: unknown) {
      console.error(error);
      return buildResponse(APP_RESPONSE.UNKNOWN_ERROR, null);
    }
  }

  @Post('create_reward_appeal')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  @ApiDataResponse({ type: RewardAppealResponseDto })
  async create_reward_appeal(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateRewardAppealDto,
  ) {
    try {
      const currentUserId =
        req.user?.id ?? req.user?.userId ?? req.user?.sub ?? '';

      return await this.rewardsService.createRewardAppeal(currentUserId, body);
    } catch (error: unknown) {
      console.error(error);
      return buildResponse(APP_RESPONSE.UNKNOWN_ERROR, null);
    }
  }
}
