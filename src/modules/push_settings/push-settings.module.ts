import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PushSetting } from './entities/push-setting.entity';
import { PushSettingsService } from './push-settings.service';
import { PushSettingsController } from './push-settings.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PushSetting])],
  providers: [PushSettingsService],
  controllers: [PushSettingsController],
  exports: [PushSettingsService],
})
export class PushSettingsModule {}
