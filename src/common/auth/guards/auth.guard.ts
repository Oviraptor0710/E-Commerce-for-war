import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';
import {
  APP_RESPONSE,
  buildResponse,
} from '../../constants/response.constants';

@Injectable()
export class AuthGuard extends PassportAuthGuard('jwt') {
  handleRequest(err: any, user: any) {
    console.log('AUTH GUARD err =', err);
    console.log('AUTH GUARD user =', user);

    if (err) {
      throw err;
    }

    if (!user) {
      throw new UnauthorizedException(
        buildResponse(APP_RESPONSE.TOKEN_INVALID, null),
      );
    }

    return user;
  }
}
