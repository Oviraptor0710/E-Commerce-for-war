import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '../../common/auth/guards/auth.guard';
import { SetUserFollowDto } from './dto/set-user-follow.dto';
import { GetListFollowedDto } from './dto/get-list-followed.dto';
import { FollowService } from './follow.service';
import { GetListFollowingDto } from './dto/get-list-following.dto';
import { ApiBearerAuth } from '@nestjs/swagger';
import { ApiDataResponse } from '../../common/swagger/api-data-response.decorator';
import {
  FollowListItemResponseDto,
  SetUserFollowResponseDataDto,
} from './dto/follow-response.dto';

type AuthenticatedRequest = Request & {
  user?: {
    id?: string;
    userId?: string;
    sub?: string;
  };
};

@ApiBearerAuth('JWT-auth')
@Controller()
export class FollowController {
  constructor(private readonly followService: FollowService) {}

  @Post('set_user_follow')
  @HttpCode(200)
  @ApiDataResponse({ type: SetUserFollowResponseDataDto })
  @UseGuards(AuthGuard)
  async setUserFollow(
    @Req() req: AuthenticatedRequest,
    @Body() dto: SetUserFollowDto,
  ) {
    const currentUserId =
      req.user?.id ?? req.user?.userId ?? req.user?.sub ?? '';

    return this.followService.setUserFollow(currentUserId, dto);
  }

  @Post('get_list_followed')
  @HttpCode(200)
  @ApiDataResponse({ type: FollowListItemResponseDto, isArray: true })
  @UseGuards(AuthGuard)
  async getListFollowed(
    @Req() req: AuthenticatedRequest,
    @Body() dto: GetListFollowedDto,
  ) {
    const currentUserId =
      req.user?.id ?? req.user?.userId ?? req.user?.sub ?? '';

    return this.followService.getListFollowed(currentUserId, dto);
  }

  @Post('get_list_following')
  @HttpCode(200)
  @ApiDataResponse({ type: FollowListItemResponseDto, isArray: true })
  @UseGuards(AuthGuard)
  async getListFollowing(
    @Req() req: AuthenticatedRequest,
    @Body() dto: GetListFollowingDto,
  ) {
    const currentUserId =
      req.user?.id ?? req.user?.userId ?? req.user?.sub ?? '';

    return this.followService.getListFollowing(currentUserId, dto);
  }
}
