import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ApiDataResponse } from './common/swagger/api-data-response.decorator';
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService, // Thêm dòng này
  ) {}

  @Get()
  @ApiDataResponse({ type: String })
  getHello(): string {
    return this.appService.getHello();
  }
  @Get('get-test-token')
  @ApiDataResponse({ type: String })
  async getTestToken() {
    return this.jwtService.sign(
      { sub: 1, username: 'test_user' },
      { secret: this.configService.get<string>('SECRET_KEY') },
    );
  }
}
