import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlocksController } from './blocks.controller';
import { BlocksService } from './blocks.service';
import { UserBlock } from './entities/user-block.entity';
import { User } from '../users/entities/user.entity';
import { UserFollow } from '../follow/entities/user-follow.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserBlock, User, UserFollow])],
  controllers: [BlocksController],
  providers: [BlocksService],
  exports: [BlocksService, TypeOrmModule],
})
export class BlocksModule {}
