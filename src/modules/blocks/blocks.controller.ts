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
import { SetUserBlockDto } from './dto/set-user-block.dto';
import { BlocksService } from './blocks.service';
import { GetListBlocksDto } from './dto/get-list-blocks.dto';
import { ApiBearerAuth } from '@nestjs/swagger';
import { ApiDataResponse } from '../../common/swagger/api-data-response.decorator';
import { BlockListItemResponseDto } from './dto/block-response.dto';

type AuthenticatedRequest = Request & {
  user?: {
    id?: string;
    userId?: string;
    sub?: string;
  };
};

@ApiBearerAuth('JWT-auth')
@Controller()
export class BlocksController {
  constructor(private readonly blocksService: BlocksService) {}

  @Post('set_user_block')
  @HttpCode(200)
  @ApiDataResponse()
  @UseGuards(AuthGuard)
  async setUserBlock(
    @Req() req: AuthenticatedRequest,
    @Body() dto: SetUserBlockDto,
  ) {
    const currentUserId =
      req.user?.id ?? req.user?.userId ?? req.user?.sub ?? '';

    return this.blocksService.setUserBlock(currentUserId, dto);
  }

  @Post('get_list_blocks')
  @HttpCode(200)
  @ApiDataResponse({ type: BlockListItemResponseDto, isArray: true })
  @UseGuards(AuthGuard)
  async getListBlocks(
    @Req() req: AuthenticatedRequest,
    @Body() dto: GetListBlocksDto,
  ) {
    const currentUserId =
      req.user?.id ?? req.user?.userId ?? req.user?.sub ?? '';

    return this.blocksService.getListBlocks(currentUserId, dto);
  }
}
