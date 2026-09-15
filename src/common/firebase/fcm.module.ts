import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DevToken } from '../../modules/dev_tokens/entities/dev-token.entity';
import { PushSetting } from '../../modules/push_settings/entities/push-setting.entity';
import { FcmService } from './fcm.service';

@Module({
  imports: [TypeOrmModule.forFeature([DevToken, PushSetting])],
  providers: [FcmService],
  exports: [FcmService],
})
export class FcmModule {}
