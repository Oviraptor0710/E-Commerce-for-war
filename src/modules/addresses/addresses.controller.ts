import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AddressesService } from './addresses.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { AuthGuard } from '../../common/auth/guards/auth.guard';
import { ParsePositiveBigIntIdPipe } from '../../common/validation';
import { ApiDataResponse } from '../../common/swagger/api-data-response.decorator';
import { AddressResponseDto } from './dto/address-response.dto';

@ApiBearerAuth('JWT-auth')
@Controller('addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @UseGuards(AuthGuard)
  @Post('create')
  @HttpCode(200)
  @ApiDataResponse({ type: AddressResponseDto })
  create(@Body() body: CreateAddressDto, @Req() req: any) {
    const userId = req.user?.userId ?? req.user?.id;
    return this.addressesService.createAddress(userId, body);
  }

  @UseGuards(AuthGuard)
  @Get('me')
  @ApiDataResponse({ type: AddressResponseDto, isArray: true })
  getMy(@Req() req: any) {
    const userId = req.user?.userId ?? req.user?.id;
    return this.addressesService.getMyAddresses(userId);
  }

  @UseGuards(AuthGuard)
  @Patch(':id/default')
  @HttpCode(200)
  @ApiDataResponse()
  setDefault(
    @Param('id', ParsePositiveBigIntIdPipe) id: string,
    @Req() req: any,
  ) {
    const userId = req.user?.userId ?? req.user?.id;
    return this.addressesService.setDefaultAddress(userId, id);
  }

  @UseGuards(AuthGuard)
  @Delete(':id')
  @HttpCode(200)
  @ApiDataResponse()
  remove(
    @Param('id', ParsePositiveBigIntIdPipe) id: string,
    @Req() req: any,
  ) {
    const userId = req.user?.userId ?? req.user?.id;
    return this.addressesService.deleteAddress(userId, id);
  }
}
