import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PushSetting } from './entities/push-setting.entity';

@Injectable()
export class PushSettingsService {
  constructor(
    @InjectRepository(PushSetting)
    private readonly pushSettingRepository: Repository<PushSetting>,
  ) {}

  async findByUserId(userId: string) {
    return this.pushSettingRepository.findOne({
      where: { user_id: userId },
    });
  }

  async createDefault(userId: string) {
    const setting = this.pushSettingRepository.create({
      user_id: userId,
      like: 1,
      comment: 1,
      transaction: 1,
      announcement: 1,
      sound_on: 1,
      sound_default: 'default',
    });

    return this.pushSettingRepository.save(setting);
  }

  async findOrCreateByUserId(userId: string) {
    let setting = await this.findByUserId(userId);

    if (!setting) {
      setting = await this.createDefault(userId);
    }

    return setting;
  }

  async updatePushSetting(
    userId: string,
    payload: {
      like?: number;
      comment?: number;
      transaction?: number;
      announcement?: number;
      sound_on?: number;
      sound_default?: string;
    },
  ) {
    const setting = await this.findOrCreateByUserId(userId);

    if (payload.like !== undefined) {
      setting.like = payload.like;
    }

    if (payload.comment !== undefined) {
      setting.comment = payload.comment;
    }

    if (payload.transaction !== undefined) {
      setting.transaction = payload.transaction;
    }

    if (payload.announcement !== undefined) {
      setting.announcement = payload.announcement;
    }

    if (payload.sound_on !== undefined) {
      setting.sound_on = payload.sound_on;
    }

    if (payload.sound_default !== undefined) {
      setting.sound_default = payload.sound_default;
    }

    return this.pushSettingRepository.save(setting);
  }
}
