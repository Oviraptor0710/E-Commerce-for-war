import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order_item.entity';
import { Shipping } from './entities/shipping.entity';
import { Address as OrderAddress } from './entities/address.entity';
import { Ward } from './entities/ward.entity';
import { Province } from './entities/province.entity';
import { OrderTimeline } from './entities/order-timeline.entity';
import { Refund } from './entities/refund.entity';
import { Product } from '../products/entities/product.entity';
import { ProductVariant } from '../products/entities/product_variant.entity';
import { User } from '../users/entities/user.entity';
import { Address } from '../orders/entities/address.entity';
import { CartItem } from './entities/cart-item.entity';
import { SellerProfile } from '../sellers/entities/seller-profile.entity';
import { AddressesModule } from '../addresses/addresses.module';
import { InventoryMovement } from '../inventory/entities/inventory-movement.entity';
import { WalletsModule } from '../wallets/wallets.module';

@Module({
  imports: [
    AddressesModule,
    WalletsModule,
    TypeOrmModule.forFeature([
      Order,
      OrderItem,
      Shipping,
      OrderAddress,
      Ward,
      Province,
      OrderTimeline,
      Refund,
      Product,
      ProductVariant,
      User,
      Address,
      CartItem,
      SellerProfile,
      InventoryMovement,
    ]),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
