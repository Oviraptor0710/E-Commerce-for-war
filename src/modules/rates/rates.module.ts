import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Rate } from './entities/rate.entity';
import { User } from '../users/entities/user.entity';
import { RatesController } from './rates.controller';
import { RatesService } from './rates.service';
import { UserBlock } from '../blocks/entities/user-block.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order_item.entity';
import { Product } from '../products/entities/product.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Rate,
      User,
      UserBlock,
      Order,
      OrderItem,
      Product,
    ]),
  ],
  controllers: [RatesController],
  providers: [RatesService],
  exports: [RatesService],
})
export class RatesModule {}
