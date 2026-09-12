import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { isCanonicalPositiveIntegerString } from '../../common/validation';

@WebSocketGateway({ cors: { origin: '*' } })
export class ConversationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  private userRoom(userId: string) {
    return `user:${userId}`;
  }

  private getToken(client: Socket): string | null {
    const auth = client.handshake.auth as Record<string, unknown>;
    const authToken = auth.jwt_token;
    if (typeof authToken === 'string' && authToken.trim()) return authToken;

    const authorization = client.handshake.headers.authorization;
    if (typeof authorization !== 'string') return null;
    const [scheme, token] = authorization.split(' ');
    return scheme?.toLowerCase() === 'bearer' && token ? token : null;
  }

  async handleConnection(client: Socket) {
    try {
      const token = this.getToken(client);
      if (!token) return client.disconnect(true);

      const secret = this.configService.get<string>('JWT_SECRET', 'dev-secret');
      const payload = await this.jwtService.verifyAsync<
        Record<string, unknown>
      >(token, { secret });
      const subject = payload.sub ?? payload.id ?? payload.userId;
      if (
        !isCanonicalPositiveIntegerString(subject)
      )
        return client.disconnect(true);
      const userId = subject;

      const user = await this.userRepo.findOne({
        where: { id: userId },
        select: { id: true, status: true },
      });
      if (!user || user.status !== 'active') return client.disconnect(true);

      await client.join(this.userRoom(user.id));
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect() {
    // Socket.IO automatically removes this socket from all rooms. Using rooms
    // also means one account can keep multiple browser/device connections.
  }

  notifyUser(receiverId: string, event: string, payload: unknown) {
    if (!this.server) return;
    this.server.to(this.userRoom(receiverId)).emit(event, payload);
  }
}
