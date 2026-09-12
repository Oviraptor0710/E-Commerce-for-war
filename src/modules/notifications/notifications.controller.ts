import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import {
  APP_RESPONSE,
  buildResponse,
} from '../../common/constants/response.constants';
import { AuthGuard } from '../../common/auth/guards/auth.guard';
import type { AuthenticatedRequest } from '../../types/auth.type';
import { GetNotiticationDto } from './dto/get-notification.dto';
import { SetReadNotificationDto } from './dto/set-read-notification.dto';
import { ApiBearerAuth } from '@nestjs/swagger';
import { ApiDataResponse } from '../../common/swagger/api-data-response.decorator';
import {
  NotificationListResponseDataDto,
  NotificationReadResponseDataDto,
} from './dto/notification-response.dto';
@ApiBearerAuth('JWT-auth')
@Controller('notification')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  private getUserId(req: AuthenticatedRequest): string {
    return req.user?.id ?? req.user?.userId ?? req.user?.sub ?? '';
  }

  @Post('get_notification')
  @HttpCode(200)
  @ApiDataResponse({ type: NotificationListResponseDataDto })
  @UseGuards(AuthGuard)
  async get_notification(
    @Req() req: AuthenticatedRequest,
    @Body() body: GetNotiticationDto,
  ) {
    try {
      return await this.notificationsService.getNotification(
        this.getUserId(req),
        body,
      );
    } catch (error: unknown) {
      console.error(error);
      return buildResponse(APP_RESPONSE.UNKNOWN_ERROR, null);
    }
  }

  @Post('set_read_notification')
  @HttpCode(200)
  @ApiDataResponse({ type: NotificationReadResponseDataDto })
  @UseGuards(AuthGuard)
  async set_read_notification(
    @Req() req: AuthenticatedRequest,
    @Body() body: SetReadNotificationDto,
  ) {
    try {
      return await this.notificationsService.setReadNotification(
        this.getUserId(req),
        body,
      );
    } catch (error: unknown) {
      console.error(error);
      return buildResponse(APP_RESPONSE.UNKNOWN_ERROR, null);
    }
  }
}
