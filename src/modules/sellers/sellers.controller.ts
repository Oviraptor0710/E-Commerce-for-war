import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../../common/auth/guards/auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { Roles } from '../../common/auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { CreateSellerApplicationDto } from './dto/create-seller-application.dto';
import { ListSellerApplicationsDto } from './dto/list-seller-applications.dto';
import { RejectSellerApplicationDto } from './dto/reject-seller-application.dto';
import { SellersService } from './sellers.service';
import { UpdateSellerProfileStatusDto } from './dto/update-seller-profile-status.dto';
import {
  ParsePositiveBigIntIdPipe,
  ParsePositiveIntIdPipe,
} from '../../common/validation';
import { ApiDataResponse } from '../../common/swagger/api-data-response.decorator';
import {
  SellerApplicationApprovalResponseDataDto,
  SellerApplicationListResponseDataDto,
  SellerApplicationResponseDto,
  SellerProfileResponseDto,
} from './dto/seller-response.dto';

interface RequestWithUser {
  user?: { id?: string; userId?: string; role?: UserRole };
}

@ApiBearerAuth('JWT-auth')
@Controller('sellers')
@UseGuards(AuthGuard, RolesGuard)
export class SellersController {
  constructor(private readonly sellersService: SellersService) {}

  private getUserId(req: RequestWithUser) {
    return req.user?.id ?? req.user?.userId ?? '';
  }

  @Post('applications')
  @HttpCode(200)
  @ApiDataResponse({ type: SellerApplicationResponseDto })
  submit(@Req() req: RequestWithUser, @Body() dto: CreateSellerApplicationDto) {
    return this.sellersService.submitApplication(this.getUserId(req), dto);
  }

  @Get('applications/me')
  @ApiDataResponse({ type: SellerApplicationListResponseDataDto })
  getMine(
    @Req() req: RequestWithUser,
    @Query() query: ListSellerApplicationsDto,
  ) {
    return this.sellersService.getMyApplications(this.getUserId(req), query);
  }

  @Get('profile/me')
  @ApiDataResponse({ type: SellerProfileResponseDto })
  getMyProfile(@Req() req: RequestWithUser) {
    return this.sellersService.getMyProfile(this.getUserId(req));
  }

  @Get('applications')
  @Roles(UserRole.ADMIN)
  @ApiDataResponse({ type: SellerApplicationListResponseDataDto })
  list(@Query() query: ListSellerApplicationsDto) {
    return this.sellersService.listApplications(query);
  }

  @Patch('applications/:id/approve')
  @Roles(UserRole.ADMIN)
  @HttpCode(200)
  @ApiDataResponse({ type: SellerApplicationApprovalResponseDataDto })
  approve(
    @Param('id', ParsePositiveBigIntIdPipe) id: string,
    @Req() req: RequestWithUser,
  ) {
    return this.sellersService.approveApplication(id, this.getUserId(req));
  }

  @Patch('applications/:id/reject')
  @Roles(UserRole.ADMIN)
  @HttpCode(200)
  @ApiDataResponse({ type: SellerApplicationResponseDto })
  reject(
    @Param('id', ParsePositiveBigIntIdPipe) id: string,
    @Req() req: RequestWithUser,
    @Body() dto: RejectSellerApplicationDto,
  ) {
    return this.sellersService.rejectApplication(
      id,
      this.getUserId(req),
      dto.reason,
    );
  }

  @Patch(':userId/status')
  @Roles(UserRole.ADMIN)
  @HttpCode(200)
  @ApiDataResponse({ type: SellerProfileResponseDto })
  updateStatus(
    @Param('userId', ParsePositiveBigIntIdPipe) userId: string,
    @Req() req: RequestWithUser,
    @Body() dto: UpdateSellerProfileStatusDto,
  ) {
    return this.sellersService.updateProfileStatus(
      userId,
      this.getUserId(req),
      dto.status,
    );
  }
}
