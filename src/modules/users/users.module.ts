import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UserCode } from './entities/user_code.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { Order } from '../orders/entities/order.entity';
import { UserFollow } from '../follow/entities/user-follow.entity';
import { UserBlock } from '../blocks/entities/user-block.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserCode, Order, UserFollow, UserBlock]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService, TypeOrmModule],
})
export class UsersModule {}
