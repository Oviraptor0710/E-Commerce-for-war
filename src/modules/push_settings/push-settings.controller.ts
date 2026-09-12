import { Body, Controller, Req, Post, UseGuards } from '@nestjs/common';
import {
  APP_RESPONSE,
  buildResponse,
} from '../../common/constants/response.constants';
import { PushSettingsService } from './push-settings.service';
import { SetPushSettingDto } from './dto/set-push-setting.dto';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../../common/auth/guards/auth.guard';
import { ApiDataResponse } from '../../common/swagger/api-data-response.decorator';
import { PushSettingResponseDataDto } from './dto/push-setting-response.dto';

@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard)
@Controller('push_settings')
export class PushSettingsController {
  constructor(private readonly pushSettingsService: PushSettingsService) {}

  @Post('get_push_setting')
  @ApiDataResponse({ status: 201, type: PushSettingResponseDataDto })
  async getPushSetting(@Req() req: any) {
    try {
      const userId = req.user.userId ?? req.user.id;

      const setting =
        await this.pushSettingsService.findOrCreateByUserId(userId);

      return buildResponse(APP_RESPONSE.OK, {
        like: setting.like,
        comment: setting.comment,
        transaction: setting.transaction,
        announcement: setting.announcement,
        sound_on: setting.sound_on,
        sound_default: setting.sound_default,
      });
    } catch (error) {
      console.error('getPushSetting error:', error);
      return buildResponse(APP_RESPONSE.EXCEPTION_ERROR, null);
    }
  }

  @Post('set_push_setting')
  @ApiDataResponse({ status: 201, type: String })
  async setPushSetting(@Req() req: any, @Body() dto: SetPushSettingDto) {
    try {
      const userId = req.user.userId ?? req.user.id;
      const hasAtLeastOneField =
        dto.like !== undefined ||
        dto.comment !== undefined ||
        dto.transaction !== undefined ||
        dto.announcement !== undefined ||
        dto.sound_on !== undefined ||
        dto.sound_default !== undefined;

      if (!hasAtLeastOneField) {
        return buildResponse(APP_RESPONSE.PARAMETER_NOT_ENOUGH, null);
      }

      await this.pushSettingsService.updatePushSetting(userId, {
        like: dto.like,
        comment: dto.comment,
        transaction: dto.transaction,
        announcement: dto.announcement,
        sound_on: dto.sound_on,
        sound_default: dto.sound_default,
      });

      return buildResponse(APP_RESPONSE.OK, 'OK');
    } catch (error) {
      console.error('setPushSetting error:', error);
      return buildResponse(APP_RESPONSE.EXCEPTION_ERROR, null);
    }
  }
}
