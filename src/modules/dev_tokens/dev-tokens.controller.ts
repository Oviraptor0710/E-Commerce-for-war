import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { APP_RESPONSE, buildResponse } from '../../common/constants/response.constants';
import { SetDevtokenDto } from './dto/set-devtoken.dto';
import { DevTokensService } from './dev-tokens.service';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../../common/auth/guards/auth.guard';
import { ApiDataResponse } from '../../common/swagger/api-data-response.decorator';

@ApiBearerAuth("JWT-auth")
@UseGuards(AuthGuard)
@Controller('dev_tokens')
export class DevTokensController {
  constructor(
    private readonly devTokensService: DevTokensService,
  ) { }

  @Post('set_devtoken')
  @ApiDataResponse({ status: 201, type: String })
  async setDevtoken(
    @Body() dto: SetDevtokenDto,
    @Req() req: any,
  ) {
    try {
      const userId = req.user.userId ?? req.user.id;

      await this.devTokensService.upsertDevToken(userId, {
        devtype: dto.devtype,
        devtoken: dto.devtoken.trim(),
      });

      return buildResponse(APP_RESPONSE.OK, 'OK');
    } catch (error) {
      console.error('setDevtoken error:', error);
      return buildResponse(APP_RESPONSE.EXCEPTION_ERROR, null);
    }
  }
}
