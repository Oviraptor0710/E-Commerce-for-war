import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rate } from './entities/rate.entity';
import { User } from '../users/entities/user.entity';
import { UserBlock } from '../blocks/entities/user-block.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order_item.entity';
import { Product } from '../products/entities/product.entity';
import { APP_RESPONSE } from '../constants/response.constants';

@Injectable()
export class RatesService {
  constructor(
    @InjectRepository(Rate)
    private readonly rateRepository: Repository<Rate>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(UserBlock)
    private readonly userBlockRepo: Repository<UserBlock>,

    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,

    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,

    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async validateSetRateInput(
    targetUserId: string,
    reviewerId: string,
    productId?: string,
    purchaseId?: string,
  ) {
    const isBlocked = await this.isUserBlocked(reviewerId, targetUserId);
    if (isBlocked) {
      return APP_RESPONSE.NOT_ACCESS;
    }

    let product: Product | null = null;
    let order: Order | null = null;

    if (productId !== undefined) {
      product = await this.getProductById(productId);
      if (!product) {
        return APP_RESPONSE.PARAMETER_VALUE_INVALID;
      }
    }

    if (purchaseId !== undefined) {
      order = await this.getOrderById(purchaseId);
      if (!order) {
        return APP_RESPONSE.PARAMETER_VALUE_INVALID;
      }

      if (order.buyer_id !== reviewerId) {
        return APP_RESPONSE.NOT_ACCESS;
      }
    }

    if (productId !== undefined && purchaseId !== undefined) {
      const orderItem = await this.getOrderItemByOrderAndProduct(
        purchaseId,
        productId,
      );

      if (!orderItem) {
        return APP_RESPONSE.PARAMETER_VALUE_INVALID;
      }

      if (product && product.seller_id !== targetUserId) {
        return APP_RESPONSE.PARAMETER_VALUE_INVALID;
      }

      if (order && order.seller_id !== targetUserId) {
        return APP_RESPONSE.PARAMETER_VALUE_INVALID;
      }
    }

    return APP_RESPONSE.OK;
  }

  async isUserBlocked(viewerId?: string, targetUserId?: string) {
    if (!viewerId || !targetUserId) return false;
    if (viewerId === targetUserId) return false;

    const block = await this.userBlockRepo.findOne({
      where: [
        { blocker_id: viewerId, blocked_id: targetUserId },
        { blocker_id: targetUserId, blocked_id: viewerId },
      ],
    });

    return !!block;
  }

  async getUserExists(userId: string) {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .select(['user.id'])
      .where('user.id = :id', { id: userId })
      .getRawOne();

    return user;
  }

  async getProductById(productId?: string) {
    if (!productId) return null;

    return this.productRepository.findOne({
      where: { id: productId },
      select: {
        id: true,
        seller_id: true,
      },
    });
  }

  async getOrderById(orderId?: string) {
    if (!orderId) return null;

    return this.orderRepository.findOne({
      where: { id: orderId },
      select: {
        id: true,
        buyer_id: true,
        seller_id: true,
      },
    });
  }

  async getOrderItemByOrderAndProduct(orderId?: string, productId?: string) {
    if (!orderId || !productId) return null;

    return this.orderItemRepository.findOne({
      where: {
        order_id: orderId,
        product_id: productId,
      },
      select: {
        id: true,
        order_id: true,
        product_id: true,
      },
    });
  }

  async getRates(
    userId: string,
    index: number,
    count: number,
    level?: number,
    productId?: string,
    purchaseId?: string,
  ) {
    const qb = this.rateRepository
      .createQueryBuilder('rate')
      .leftJoin(User, 'reviewer', 'reviewer.id = rate.reviewer_id')
      .select([
        'rate.id AS id',
        'rate.reviewer_id AS reviewer_id',
        'reviewer.username AS username',
        'reviewer.avatar AS avatar',
        'reviewer.cover_image AS cover_image',
        'reviewer.cover_image_web AS cover_image_web',
        'rate.content AS content',
        'rate.level AS level',
        'rate.product_id AS product_id',
        'rate.purchase_id AS purchase_id',
        'rate.created_at AS created',
      ])
      .where('rate.user_id = :userId', { userId });

    if (level !== undefined && level !== 0) {
      qb.andWhere('rate.level = :level', { level });
    }

    if (productId !== undefined) {
      qb.andWhere('rate.product_id = :productId', { productId });
    }

    if (purchaseId !== undefined) {
      qb.andWhere('rate.purchase_id = :purchaseId', { purchaseId });
    }

    const data = await qb
      .orderBy('rate.created_at', 'DESC')
      .offset(index)
      .limit(count)
      .getRawMany();

    return data;
  }

  async setRate(
    userId: string,
    reviewerId: string,
    level: number,
    content: string,
    productId?: string,
    purchaseId?: string,
  ) {
    const rate = this.rateRepository.create({
      user_id: userId,
      reviewer_id: reviewerId,
      level,
      content,
      product_id: productId,
      purchase_id: purchaseId,
    });

    return await this.rateRepository.save(rate);
  }
}
