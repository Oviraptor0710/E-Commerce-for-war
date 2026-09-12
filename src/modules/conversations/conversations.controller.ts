import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../common/auth/guards/auth.guard';
import type { AuthenticatedRequest } from '../../types/auth.type';
import { SendMessageDto } from './dto/send-message.dto';
import { ConversationsService } from './conversations.service';
import { APP_RESPONSE } from '../../common/constants/response.constants';
import { buildResponse } from '../../common/constants/response.constants';
import { GetListConvDto } from './dto/get-list-conversation.dto';
import { GetConvDto } from './dto/get-conversation.dto';
import { SetReadMessageDto } from './dto/set-read-message.dto';
import { ApiBearerAuth } from '@nestjs/swagger';
import { ApiDataResponse } from '../../common/swagger/api-data-response.decorator';
import {
  ConversationDetailResponseDataDto,
  ConversationListResponseDataDto,
  ReadMessageResponseDataDto,
  SendMessageResponseDataDto,
} from './dto/conversation-response.dto';

@ApiBearerAuth('JWT-auth')
@Controller('conversation')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  private getUserId(req: AuthenticatedRequest): string {
    return req.user?.id ?? req.user?.userId ?? req.user?.sub ?? '';
  }

  @Post('send_message')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  @ApiDataResponse({ type: SendMessageResponseDataDto })
  async send_message(
    @Req() req: AuthenticatedRequest,
    @Body() body: SendMessageDto,
  ) {
    try {
      return await this.conversationsService.sendMessage(
        this.getUserId(req),
        body,
      );
    } catch (error: unknown) {
      console.error(error);
      return buildResponse(APP_RESPONSE.UNKNOWN_ERROR, null);
    }
  }

  @Post('get_list_conversation')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  @ApiDataResponse({ type: ConversationListResponseDataDto })
  async get_list_conversation(
    @Req() req: AuthenticatedRequest,
    @Body() body: GetListConvDto,
  ) {
    try {
      return await this.conversationsService.getListConversation(
        this.getUserId(req),
        body,
      );
    } catch (error: unknown) {
      console.error(error);
      return buildResponse(APP_RESPONSE.UNKNOWN_ERROR, null);
    }
  }

  @Post('get_conversation')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  @ApiDataResponse({ type: ConversationDetailResponseDataDto })
  async get_conversation(
    @Req() req: AuthenticatedRequest,
    @Body() body: GetConvDto,
  ) {
    try {
      return await this.conversationsService.getConversation(
        this.getUserId(req),
        body,
      );
    } catch (error: unknown) {
      console.error(error);
      return buildResponse(APP_RESPONSE.UNKNOWN_ERROR, null);
    }
  }

  @Post('set_read_message')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  @ApiDataResponse({ type: ReadMessageResponseDataDto })
  async set_read_message(
    @Req() req: AuthenticatedRequest,
    @Body() body: SetReadMessageDto,
  ) {
    try {
      return await this.conversationsService.setReadMessage(
        this.getUserId(req),
        body,
      );
    } catch (error: unknown) {
      console.error(error);
      return buildResponse(APP_RESPONSE.UNKNOWN_ERROR, null);
    }
  }
}
