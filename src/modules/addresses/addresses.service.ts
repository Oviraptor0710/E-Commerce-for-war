import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Address } from '../orders/entities/address.entity';
import { Ward } from '../orders/entities/ward.entity';
import { User } from '../users/entities/user.entity';
import { Product } from '../products/entities/product.entity';
import { SellerApplication } from '../sellers/entities/seller-application.entity';
import { SellerProfile } from '../sellers/entities/seller-profile.entity';
import { SellerApplicationStatus } from '../sellers/enums/seller-application-status.enum';
import { CreateAddressDto } from './dto/create-address.dto';
import {
  APP_RESPONSE,
  buildResponse,
} from '../../common/constants/response.constants';

@Injectable()
export class AddressesService {
  constructor(
    @InjectRepository(Address)
    private readonly addressRepository: Repository<Address>,
    @InjectRepository(Ward)
    private readonly wardRepository: Repository<Ward>,
  ) {}

  async createAddress(userId: string, body: CreateAddressDto) {
    if (!userId || !body) {
      return buildResponse(APP_RESPONSE.PARAMETER_NOT_ENOUGH, null);
    }

    const addressDetail = body.address_detail?.trim();
    const receiverName = body.receiver_name?.trim();
    const phone = body.phone?.trim();

    if (!addressDetail || !receiverName || !phone) {
      return buildResponse(APP_RESPONSE.PARAMETER_NOT_ENOUGH, null);
    }

    const ward = await this.wardRepository.findOne({
      where: {
        id: body.ward_id,
        province_id: body.province_id,
      },
      relations: { province: true },
    });

    if (!ward?.province) {
      return buildResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID, null);
    }

    const fullAddress = [addressDetail, ward.name, ward.province.name].join(
      ', ',
    );
    const saved = await this.addressRepository.manager.transaction(
      async (manager) => {
        const user = await manager
          .getRepository(User)
          .createQueryBuilder('user')
          .where('user.id = :userId', { userId })
          .setLock('pessimistic_write')
          .getOne();
        if (!user) return null;

        if (body.is_default === true) {
          await manager.update(
            Address,
            { user_id: userId, is_default: true, deleted_at: IsNull() },
            { is_default: false },
          );
        }

        return manager.save(
          Address,
          manager.create(Address, {
            user_id: userId,
            ward_id: ward.id,
            receiver_name: receiverName,
            phone,
            full_address: fullAddress,
            is_default: body.is_default === true,
            address_name: body.address_name?.trim() || null,
            address_detail: addressDetail,
          }),
        );
      },
    );

    return saved
      ? buildResponse(APP_RESPONSE.OK, saved)
      : buildResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID, null);
  }

  async getMyAddresses(userId: string) {
    const list = await this.addressRepository.find({
      where: { user_id: userId },
      relations: { ward: { province: true } },
      order: { is_default: 'DESC', id: 'DESC' },
    });

    return buildResponse(APP_RESPONSE.OK, list);
  }

  async setDefaultAddress(userId: string, addressId: string) {
    if (!userId || !/^\d+$/.test(addressId) || BigInt(addressId) <= 0n) {
      return buildResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID, null);
    }

    const result = await this.addressRepository.manager.transaction(
      async (manager) => {
        const user = await manager
          .getRepository(User)
          .createQueryBuilder('user')
          .where('user.id = :userId', { userId })
          .setLock('pessimistic_write')
          .getOne();
        if (!user) return false;

        const address = await manager.findOne(Address, {
          where: { id: addressId, user_id: userId, deleted_at: IsNull() },
          lock: { mode: 'pessimistic_write' },
        });

        if (!address) return false;

        await manager.update(
          Address,
          { user_id: userId, is_default: true, deleted_at: IsNull() },
          { is_default: false },
        );
        await manager.update(Address, address.id, { is_default: true });
        return true;
      },
    );

    return result
      ? buildResponse(APP_RESPONSE.OK, null)
      : buildResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID, null);
  }

  async deleteAddress(userId: string, addressId: string) {
    if (!userId || !/^\d+$/.test(addressId) || BigInt(addressId) <= 0n) {
      return buildResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID, null);
    }

    const deleted = await this.addressRepository.manager.transaction(
      async (manager) => {
        const user = await manager
          .getRepository(User)
          .createQueryBuilder('user')
          .where('user.id = :userId', { userId })
          .setLock('pessimistic_write')
          .getOne();
        if (!user) return false;

        const address = await manager.findOne(Address, {
          where: { id: addressId, user_id: userId, deleted_at: IsNull() },
          lock: { mode: 'pessimistic_write' },
        });
        if (!address || address.is_default) return false;

        const pendingApplication = await manager.exists(SellerApplication, {
          where: {
            ship_from_address_id: addressId,
            status: SellerApplicationStatus.PENDING,
          },
        });
        const sellerProfile = await manager.exists(SellerProfile, {
          where: { default_ship_from_address_id: addressId },
        });
        const activeProduct = await manager.exists(Product, {
          where: { ship_from_id: addressId, deleted_at: IsNull() },
        });

        if (pendingApplication || sellerProfile || activeProduct) return false;

        const result = await manager.softDelete(Address, {
          id: addressId,
          user_id: userId,
        });
        return result.affected === 1;
      },
    );

    return deleted
      ? buildResponse(APP_RESPONSE.OK, null)
      : buildResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID, null);
  }
}
