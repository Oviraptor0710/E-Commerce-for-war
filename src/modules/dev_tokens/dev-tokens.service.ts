import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DevToken } from './entities/dev-token.entity';

@Injectable()
export class DevTokensService {
  constructor(
    @InjectRepository(DevToken)
    private readonly devTokenRepository: Repository<DevToken>,
  ) {}

  async upsertDevToken(
    userId: string,
    payload: {
      devtype: string;
      devtoken: string;
    },
  ) {
    const existed = await this.devTokenRepository.findOne({
      where: { devtoken: payload.devtoken },
    });

    if (existed) {
      existed.user_id = userId;
      existed.devtype = payload.devtype;
      existed.is_active = true;
      return this.devTokenRepository.save(existed);
    }

    const devToken = this.devTokenRepository.create({
      user_id: userId,
      devtype: payload.devtype,
      devtoken: payload.devtoken,
      is_active: true,
    });

    return this.devTokenRepository.save(devToken);
  }
}
