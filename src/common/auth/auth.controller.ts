import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CreateCodeResetPasswordDto } from './dto/create-code-reset-password.dto';
import { CheckCodeResetPasswordDto } from './dto/check-code-reset-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ChangeInfoAfterSignupDto } from './dto/change-info-after-signup.dto';
import { APP_RESPONSE, buildResponse } from '../constants/response.constants';
import type { AuthenticatedRequest } from '../../types/auth.type';
import { ApiBearerAuth } from '@nestjs/swagger';
import { ApiDataResponse } from '../swagger/api-data-response.decorator';
import {
  AuthenticatedUserResponseDataDto,
  AuthSessionResponseDataDto,
  ChangeInfoAfterSignupResponseDataDto,
  ResetPasswordOtpResponseDataDto,
  SignupResponseDataDto,
} from './dto/auth-response.dto';

@ApiBearerAuth('JWT-auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private extractBearerToken(authorization?: string): string | null {
    if (!authorization) return null;

    const [type, token] = authorization.split(' ');
    if (type !== 'Bearer' || !token) return null;

    return token;
  }

  @Post('signup')
  @ApiDataResponse({ status: 201, type: SignupResponseDataDto })
  async signup(@Body() signupDto: SignupDto) {
    console.log('signup');
    return this.authService.signup(signupDto);
  }

  @Post('login')
  @ApiDataResponse({ status: 201, type: AuthSessionResponseDataDto })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @UseGuards(AuthGuard)
  @Get('me')
  @ApiDataResponse({ type: AuthenticatedUserResponseDataDto })
  me(@Req() req: AuthenticatedRequest) {
    return buildResponse(APP_RESPONSE.OK, req.user ?? null);
  }

  @Post('create_code_reset_password')
  @ApiDataResponse({ status: 201, type: ResetPasswordOtpResponseDataDto })
  async createCodeResetPassword(@Body() dto: CreateCodeResetPasswordDto) {
    return this.authService.createCodeResetPassword(dto);
  }

  @Post('check_code_reset_password')
  @ApiDataResponse({ status: 201 })
  async checkCodeResetPassword(@Body() dto: CheckCodeResetPasswordDto) {
    return this.authService.checkCodeResetPassword(dto);
  }

  @Post('reset_password')
  @ApiDataResponse({ status: 201, type: AuthSessionResponseDataDto })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @UseGuards(AuthGuard)
  @Post('change_password')
  @ApiDataResponse({ status: 201, type: String })
  async changePassword(@Body() dto: ChangePasswordDto, @Req() req: any) {
    return this.authService.changePassword(dto, req.user.userId ?? req.user.id);
  }

  @UseGuards(AuthGuard)
  @Post('change_info_after_signup')
  @ApiDataResponse({ status: 201, type: ChangeInfoAfterSignupResponseDataDto })
  async changeInfoAfterSignup(
    @Body() dto: ChangeInfoAfterSignupDto,
    @Req() req: any,
  ) {
    return this.authService.changeInfoAfterSignup(
      dto,
      req.user.userId ?? req.user.id,
    );
  }

  @UseGuards(AuthGuard)
  @Post('logout')
  @ApiDataResponse({ status: 201 })
  async logout(@Req() req: any) {
    return this.authService.logout(req.user.userId ?? req.user.id);
  }
}
