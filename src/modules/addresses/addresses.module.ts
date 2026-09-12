import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Address } from '../orders/entities/address.entity';
import { Ward } from '../orders/entities/ward.entity';
import { AddressesService } from './addresses.service';
import { AddressesController } from './addresses.controller';
import { User } from '../users/entities/user.entity';
import { Product } from '../products/entities/product.entity';
import { SellerApplication } from '../sellers/entities/seller-application.entity';
import { SellerProfile } from '../sellers/entities/seller-profile.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Address,
      Ward,
      User,
      Product,
      SellerApplication,
      SellerProfile,
    ]),
  ],
  providers: [AddressesService],
  controllers: [AddressesController],
  exports: [AddressesService],
})
export class AddressesModule {}
