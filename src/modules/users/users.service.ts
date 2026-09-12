import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { GetUserInfoDto } from './dto/get-user-info.dto';
import { APP_RESPONSE, buildResponse } from '../constants/response.constants';
import { Order } from '../orders/entities/order.entity';
import { UserFollow } from '../follow/entities/user-follow.entity';
import { UserBlock } from '../blocks/entities/user-block.entity';
import { SetUserInfoDto } from './dto/set-user-info.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,

    @InjectRepository(Order)
    private readonly ordersRepo: Repository<Order>,

    @InjectRepository(UserFollow)
    private readonly followsRepo: Repository<UserFollow>,

    @InjectRepository(UserBlock)
    private readonly blocksRepo: Repository<UserBlock>,
  ) {}

  async create(payload: Partial<User>): Promise<User> {
    const user = this.usersRepository.create(payload);
    return this.usersRepository.save(user);
  }

  async findByPhone(phone_number: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { phone_number },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { id },
    });
  }

  async findByPhoneWithPassword(phone_number: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.phone_number = :phone_number', { phone_number })
      .getOne();
  }

  async findByIdWithPassword(id: string) {
    return this.usersRepository.findOne({
      where: { id },
      select: ['id', 'username', 'password', 'role', 'avatar', 'fullname'],
    });
  }

  async updatePassword(id: string, password: string): Promise<void> {
    await this.usersRepository.update(id, { password });
  }

  async updateInfoAfterSignup(
    userId: string,
    payload: {
      username: string;
      avatar?: string;
    },
  ) {
    await this.usersRepository.update(userId, {
      username: payload.username,
      avatar: payload.avatar,
    });
  }

  async getUserInfo(currentUserId: string, body: GetUserInfoDto) {
    console.log(body);
    const user_id = body.user_id === '0' ? currentUserId : body.user_id;
    console.log(user_id);
    let user = await this.usersRepository.findOne({
      where: {
        id: user_id,
      },
      relations: ['addresses'],
    });
    if (!user) {
      return {
        ...APP_RESPONSE.USER_NOT_EXIST,
        data: null,
      };
    }
    let order_count = await this.ordersRepo.count({
      where: { seller_id: user_id },
    });
    let follower_count = await this.followsRepo.count({
      where: { followee_id: user_id },
    });
    let following_count = await this.followsRepo.count({
      where: { follower_id: user_id },
    });
    let check_follow = 0;
    let check_block = 0;
    if (user_id && currentUserId) {
      check_follow = await this.followsRepo.count({
        where: {
          follower: { id: currentUserId },
          followee: { id: user_id },
        },
      });
      check_block = await this.blocksRepo.count({
        where: {
          blocked: { id: user_id },
          blocker: { id: currentUserId },
        },
      });
    }
    let info: any = {};
    if (body.user_id === '0' || body.user_id === currentUserId) {
      info['email'] = user.email;
      info['phonenumber'] = user.phone_number;
      info['firstname'] = user.firstname;
      info['lastname'] = user.lastname;
      info['address'] = user.address;
      info['city'] = user.city;
    }
    info['id'] = user.id;
    info['username'] = user.username;
    info['listing'] = order_count;
    info['followers'] = follower_count;
    info['following'] = following_count;
    info['status'] = user.status;
    info['avatar'] = user.avatar;
    info['cover_image'] = user.cover_image;
    info['cover_image_web'] = user.cover_image_web;
    info['followed'] = check_follow > 0;
    info['is_blocked'] = check_block > 0;
    info['online'] = 1;
    if (user.addresses.length > 0)
      info['default_address'] = {
        address_id: user.addresses[0].id,
        address: user.addresses[0].address_detail,
        pick_support: true,
      };

    return buildResponse(APP_RESPONSE.OK, info);
  }

  async setUserInfo(currentUserId: string, body: SetUserInfoDto) {
    if (body) {
      const payload: Partial<User> = { ...body };

      if (typeof payload.email === 'string') {
        const normalizedEmail = payload.email.trim().toLowerCase();
        payload.email = normalizedEmail === '' ? null : normalizedEmail;
      }

      await this.usersRepository.update({ id: currentUserId }, payload as any);
    }

    let user = await this.usersRepository.findOne({
      where: {
        id: currentUserId,
      },
    });

    return buildResponse(APP_RESPONSE.OK, {
      avatar: user?.avatar,
      cover_image: user?.cover_image,
      cover_image_web: user?.cover_image_web,
    });
  }
}
