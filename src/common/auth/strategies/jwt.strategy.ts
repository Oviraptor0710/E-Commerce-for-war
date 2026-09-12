import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../../modules/users/users.service';
import {
  APP_RESPONSE,
  buildResponse,
} from '../../constants/response.constants';
import {
  isCanonicalPositiveIntegerString,
  isWithinMysqlSignedBigIntRange,
} from '../../validation';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'dev-secret'),
    });
  }

  async validate(payload: { sub: unknown; username: string; role: string }) {
    console.log('JWT payload:', payload);
    if (
      !isCanonicalPositiveIntegerString(payload.sub) ||
      !isWithinMysqlSignedBigIntRange(payload.sub)
    ) {
      throw new UnauthorizedException(
        buildResponse(APP_RESPONSE.TOKEN_INVALID, null),
      );
    }

    const userId = payload.sub;
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnauthorizedException(
        buildResponse(APP_RESPONSE.USER_NOT_VALIDATED, null),
      );
    }

    return {
      id: user.id,
      userId: user.id,
      username: user.username,
      role: user.role,
    };
  }
}
