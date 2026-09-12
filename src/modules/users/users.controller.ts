import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '../../common/auth/guards/auth.guard';
import type { AuthenticatedRequest } from '../../types/auth.type';
import { GetUserInfoDto } from './dto/get-user-info.dto';
import {
  APP_RESPONSE,
  buildResponse,
} from '../../common/constants/response.constants';
import { SetUserInfoDto } from './dto/set-user-info.dto';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { OptionalAuthGuard } from '../../common/auth/guards/optional-auth.guard';
import { GetUserInfoResponseDto } from './dto/get-user-info-response.dto';
import { SetUserInfoResponseDataDto } from './dto/get-user-info-response.dto';
import { ApiDataResponse } from '../../common/swagger/api-data-response.decorator';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('get_user_info')
  @HttpCode(200)
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({
    summary: 'Lấy thông tin người dùng',
    description:
      'JWT là tùy chọn khi xem người dùng khác. Truyền user_id="0" để xem chính mình; trường hợp đó cần gửi JWT hợp lệ.',
  })
  @ApiOkResponse({
    description:
      'Thông tin người dùng hoặc data bằng null nếu không thành công.',
    type: GetUserInfoResponseDto,
  })
  async get_user_info(
    @Req() req: AuthenticatedRequest,
    @Body() body: GetUserInfoDto,
  ) {
    try {
      const currentUserId =
        req.user?.id ?? req.user?.userId ?? req.user?.sub ?? '';

      return await this.usersService.getUserInfo(currentUserId, body);
    } catch (error: unknown) {
      console.error(error);
      return buildResponse(APP_RESPONSE.UNKNOWN_ERROR, null);
    }
  }

  @Post('set_user_info')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  @ApiDataResponse({ type: SetUserInfoResponseDataDto })
  async set_user_info(
    @Req() req: AuthenticatedRequest,
    @Body() body: SetUserInfoDto,
  ) {
    try {
      const currentUserId =
        req.user?.id ?? req.user?.userId ?? req.user?.sub ?? '';

      return await this.usersService.setUserInfo(currentUserId, body);
    } catch (error: unknown) {
      console.error(error);
      return buildResponse(APP_RESPONSE.UNKNOWN_ERROR, null);
    }
  }
}
