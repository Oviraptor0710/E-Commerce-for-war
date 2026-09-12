import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { RatesService } from './rates.service';
import { AuthGuard } from '../../common/auth/guards/auth.guard';
import { APP_RESPONSE, buildResponse } from '../constants/response.constants';
import { GetRatesDto } from './dto/get_rates.dto';
import { SetRateDto } from './dto/set_rate.dto';
import { ApiDataResponse } from '../../common/swagger/api-data-response.decorator';
import { RateListItemResponseDto, SetRateResponseDataDto } from './dto/rate-response.dto';

interface RequestWithUser extends Request {
  user: {
    id?: string;
    userId?: string;
  };
}

@Controller('api')
export class RatesController {
  constructor(private readonly ratesService: RatesService) {}

  @Post('get_rates')
  @UseGuards(AuthGuard)
  @ApiDataResponse({ status: 201, type: RateListItemResponseDto, isArray: true })
  async getRates(@Req() req: RequestWithUser, @Body() dto: GetRatesDto) {
    try {
      const authUserId = req.user?.userId ?? req.user?.id;

      if (!authUserId) {
        return buildResponse(APP_RESPONSE.TOKEN_INVALID, null);
      }

      const targetUserId = dto.user_id ?? authUserId;

      const userExists = await this.ratesService.getUserExists(targetUserId);
      if (!userExists) {
        return buildResponse(APP_RESPONSE.USER_NOT_EXIST, null);
      }

      const isBlocked = await this.ratesService.isUserBlocked(
        authUserId,
        targetUserId,
      );

      if (isBlocked) {
        return buildResponse(APP_RESPONSE.NOT_ACCESS, null);
      }

      const data = await this.ratesService.getRates(
        targetUserId,
        dto.index,
        dto.count,
        dto.level,
        dto.product_id,
        dto.purchase_id,
      );

      if (!data || data.length === 0) {
        return buildResponse(APP_RESPONSE.NO_DATA_OR_END_OF_LIST, []);
      }

      return buildResponse(APP_RESPONSE.OK, data);
    } catch (error) {
      console.error('get_rates error:', error);
      return buildResponse(APP_RESPONSE.EXCEPTION_ERROR, null);
    }
  }

  @Post('set_rates')
  @UseGuards(AuthGuard)
  @ApiDataResponse({ status: 201, type: SetRateResponseDataDto })
  async setRates(@Req() req: RequestWithUser, @Body() dto: SetRateDto) {
    try {
      const reviewerId = req.user?.userId ?? req.user?.id;

      if (!reviewerId) {
        return buildResponse(APP_RESPONSE.TOKEN_INVALID, null);
      }

      const userExists = await this.ratesService.getUserExists(dto.user_id);
      if (!userExists) {
        return buildResponse(APP_RESPONSE.USER_NOT_EXIST, null);
      }

      const validateResult = await this.ratesService.validateSetRateInput(
        dto.user_id,
        reviewerId,
        dto.product_id,
        dto.purchase_id,
      );

      if (validateResult !== APP_RESPONSE.OK) {
        return buildResponse(validateResult, null);
      }

      const data = await this.ratesService.setRate(
        dto.user_id,
        reviewerId,
        dto.level,
        dto.content,
        dto.product_id,
        dto.purchase_id,
      );

      return buildResponse(APP_RESPONSE.OK, data);
    } catch (error) {
      console.error('set_rates error:', error);
      return buildResponse(APP_RESPONSE.EXCEPTION_ERROR, null);
    }
  }
}
