import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Address } from '../orders/entities/address.entity';
import { SellerApplication } from './entities/seller-application.entity';
import { SellerProfile } from './entities/seller-profile.entity';
import { SellersController } from './sellers.controller';
import { SellersService } from './sellers.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Address, SellerApplication, SellerProfile]),
  ],
  controllers: [SellersController],
  providers: [SellersService],
  exports: [SellersService, TypeOrmModule],
})
export class SellersModule {}
