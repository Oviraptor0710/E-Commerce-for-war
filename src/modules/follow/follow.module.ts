import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { FollowController } from './follow.controller';
import { FollowService } from './follow.service';
import { UserFollow } from './entities/user-follow.entity';
import { UserBlock } from '../blocks/entities/user-block.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserFollow, User, UserBlock])],
  controllers: [FollowController],
  providers: [FollowService],
  exports: [FollowService],
})
export class FollowModule {}
