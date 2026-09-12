import { createHash } from 'crypto';
import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order_item.entity';
import { Shipping } from './entities/shipping.entity';
import { Refund } from './entities/refund.entity';
import { Product } from '../products/entities/product.entity';
import { ProductVariant } from '../products/entities/product_variant.entity';
import { User } from '../users/entities/user.entity';
import { Address as OrderAddress } from './entities/address.entity';
import { Address } from '../orders/entities/address.entity';
import { Ward } from './entities/ward.entity';
import { Province } from './entities/province.entity';
import { OrderTimeline } from './entities/order-timeline.entity';
import { CartItem } from './entities/cart-item.entity';
import { WalletLedgerService } from '../wallets/wallet-ledger.service';
import { WalletBalanceBucket } from '../wallets/enums/wallet-balance-bucket.enum';
import { WalletEntryDirection } from '../wallets/enums/wallet-entry-direction.enum';
import { WalletOperationType } from '../wallets/enums/wallet-operation-type.enum';
import { WalletReferenceType } from '../wallets/enums/wallet-reference-type.enum';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus } from './enums/order-status.enum';
import { OrderStatusChangeSource } from './enums/order-status-change-source.enum';
import { SettlementStatus } from './enums/settlement-status.enum';
import { GetListPurchasesDto } from './dto/get-list-purchases.dto';
import { GetListPurchasesSellerDto } from './dto/get_list_purchases_seller.dto';
import { GetPurchaseDto } from './dto/get-purchase.dto';
import { EditPurchaseDto } from './dto/edit-purchase.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { SetAcceptBuyerDto } from './dto/set-accept-buyer.dto';
import { BuyerConfirmReceivedDto } from './dto/buyer-confirm-received.dto';
import { RefundOrderDto } from './dto/refund-order.dto';
import { RespondRefundDto } from './dto/respond-refund.dto';
import { SellerMarkAsShippedDto } from './dto/seller-mark-as-shipped.dto';
import { GetOrderTimelineDto } from './dto/get-order-timeline.dto';
import { GetShipFromQueryDto } from './dto/ship_from.dto';
import { GetShipFeeDto } from './dto/getshipfee.dto';
import { UpdateOrderAddressDto } from './dto/update_order_address.dto';
import { GetOrderStatusDto } from './dto/get_order_status.dto';
import { APP_RESPONSE, buildResponse } from '../constants/response.constants';
import { AddOrderAddressDto } from './dto/add_order_address.dto';
import { AddCartDto } from './dto/add-cart.dto';
import { EditCartDto } from './dto/edit-cart.dto';
import { DeleteCartDto } from './dto/delete-cart.dto';
import { AddressesService } from '../addresses/addresses.service';
import { SellerProfile } from '../sellers/entities/seller-profile.entity';
import { SellerProfileStatus } from '../sellers/enums/seller-profile-status.enum';
import { InventoryMovement } from '../inventory/entities/inventory-movement.entity';
import { InventoryMovementType } from '../inventory/enums/inventory-movement-type.enum';
import { RefundStatus } from './enums/refund-status.enum';
import { RefundDecisionSource } from './enums/refund-decision-source.enum';
import { isCanonicalPositiveIntegerString } from '../../common/validation';

const errorResponse = (response: { code: string; message: string }) =>
  buildResponse(response, null);

@Injectable()
export class OrdersService {
  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,

    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,

    @InjectRepository(Shipping)
    private readonly shippingRepository: Repository<Shipping>,

    @InjectRepository(Refund)
    private readonly refundRepository: Repository<Refund>,

    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,

    @InjectRepository(ProductVariant)
    private readonly productVariantRepository: Repository<ProductVariant>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(Address)
    private readonly addressRepository: Repository<Address>,

    @InjectRepository(OrderAddress)
    private readonly orderAddressRepository: Repository<OrderAddress>,

    @InjectRepository(Ward)
    private readonly wardRepository: Repository<Ward>,

    @InjectRepository(Province)
    private readonly provinceRepository: Repository<Province>,

    @InjectRepository(OrderTimeline)
    private readonly orderTimelineRepository: Repository<OrderTimeline>,

    @InjectRepository(CartItem)
    private readonly cartItemRepository: Repository<CartItem>,

    @InjectRepository(SellerProfile)
    private readonly sellerProfileRepository: Repository<SellerProfile>,

    private readonly addressesService: AddressesService,

    private readonly walletLedgerService: WalletLedgerService,
  ) {}

  private getVariantEffectivePrice(variant?: ProductVariant | null) {
    if (!variant) return 0;
    return variant.discount_price === null ||
      variant.discount_price === undefined
      ? Number(variant.price || 0)
      : Number(variant.discount_price);
  }

  private async restoreOrderStock(
    manager: EntityManager,
    orderId: string,
    reason: string,
  ) {
    const orderItems = await manager.find(OrderItem, {
      where: { order_id: orderId },
    });
    if (orderItems.length === 0) return;

    const orderItemIds = orderItems.map((item) => item.id);
    const movementRepository = manager.getRepository(InventoryMovement);
    const deductions = await movementRepository.find({
      where: {
        order_item_id: In(orderItemIds),
        type: InventoryMovementType.ORDER_DEDUCTED,
      },
      order: { id: 'ASC' },
    });
    if (deductions.length === 0) return;

    const existingRestores = await movementRepository.find({
      where: {
        order_item_id: In(orderItemIds),
        type: InventoryMovementType.ORDER_CANCELLED_RESTORE,
      },
    });
    const restoredItemIds = new Set(
      existingRestores.map((movement) => movement.order_item_id),
    );

    const variantIds = Array.from(
      new Set(deductions.map((movement) => movement.variant_id)),
    ).sort((a, b) => a.localeCompare(b));
    const lockedVariants = await manager
      .getRepository(ProductVariant)
      .createQueryBuilder('variant')
      .where('variant.id IN (:...variantIds)', { variantIds })
      .orderBy('variant.id', 'ASC')
      .setLock('pessimistic_write')
      .getMany();
    const variantsById = new Map(
      lockedVariants.map((variant) => [variant.id, variant]),
    );

    const restores: InventoryMovement[] = [];
    for (const deduction of deductions) {
      if (restoredItemIds.has(deduction.order_item_id)) continue;

      const variant = variantsById.get(deduction.variant_id);
      if (!variant) {
        throw new BadRequestException(
          errorResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID),
        );
      }

      const quantityToRestore = Math.abs(deduction.quantity_delta);
      const stockBefore = variant.stock;
      const stockAfter = stockBefore + quantityToRestore;
      variant.stock = stockAfter;
      await manager.save(ProductVariant, variant);

      restores.push(
        manager.create(InventoryMovement, {
          variant_id: variant.id,
          order_item_id: deduction.order_item_id,
          type: InventoryMovementType.ORDER_CANCELLED_RESTORE,
          quantity_delta: quantityToRestore,
          stock_before: stockBefore,
          stock_after: stockAfter,
          idempotency_key: `ORDER_STOCK_RESTORE:${orderId}:${variant.id}`,
          created_by: null,
          reason,
        }),
      );
    }

    if (restores.length > 0) {
      await manager.save(InventoryMovement, restores);
    }
  }

  async createOrder(body: CreateOrderDto, userId: string) {
    const buyer = await this.userRepository.findOne({ where: { id: userId } });
    if (!buyer)
      throw new UnauthorizedException(
        errorResponse(APP_RESPONSE.TOKEN_INVALID),
      );
    if (!body.items?.length || !body.idempotency_key)
      throw new BadRequestException(
        errorResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID),
      );
    const orderSource = body.order_source ?? body.source;
    const addressId = body.address_id;
    const variantIds = body.items.map((item) => item.variant_id);
    if (
      ![0, 1].includes(orderSource) ||
      !isCanonicalPositiveIntegerString(addressId) ||
      variantIds.some((id) => !isCanonicalPositiveIntegerString(id)) ||
      new Set(variantIds).size !== variantIds.length
    ) {
      throw new BadRequestException(
        errorResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID),
      );
    }
    const normalizedItems = [...body.items]
      .map((item) => ({
        variant_id: item.variant_id,
        quantity: item.quantity,
      }))
      .sort((a, b) => a.variant_id.localeCompare(b.variant_id));
    const requestHash = createHash('sha256')
      .update(
        JSON.stringify({
          address_id: addressId,
          order_source: orderSource,
          items: normalizedItems,
        }),
      )
      .digest('hex');
    const existing = await this.orderRepository.findOne({
      where: {
        buyer_id: buyer.id,
        checkout_idempotency_key: body.idempotency_key,
      },
    });
    if (existing) {
      if (existing.checkout_request_hash !== requestHash)
        throw new BadRequestException(
          'idempotency_key đã được dùng cho payload checkout khác.',
        );
      return buildResponse(APP_RESPONSE.OK, {
        order_id: existing.id,
        status: existing.status,
        total_price: Number(existing.total_price),
        shipping_fee: Number(existing.shipping_fee),
        final_price: this.getOrderAmount(existing),
      });
    }
    const address = await this.addressRepository.findOne({
      where: { id: addressId, user_id: buyer.id },
    });
    if (!address || address.deleted_at)
      throw new BadRequestException(
        errorResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID),
      );
    try {
      return await this.dataSource.transaction(async (manager) => {
        const lockedVariants = await manager
          .getRepository(ProductVariant)
          .createQueryBuilder('variant')
          .leftJoinAndSelect('variant.product', 'product')
          .leftJoinAndSelect('product.ship_from', 'ship_from')
          .where('variant.id IN (:...variantIds)', { variantIds })
          .orderBy('variant.id', 'ASC')
          .setLock('pessimistic_write')
          .getMany();
        if (
          lockedVariants.length !== variantIds.length ||
          lockedVariants.some((v) => v.deleted_at || v.product?.deleted_at)
        )
          throw new BadRequestException(
            errorResponse(APP_RESPONSE.PRODUCT_NOT_EXISTED),
          );
        const sellerId = lockedVariants[0].product.seller_id;
        if (
          buyer.id === sellerId ||
          lockedVariants.some((v) => v.product.seller_id !== sellerId)
        )
          throw new BadRequestException(
            errorResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID),
          );
        const seller = await manager
          .getRepository(SellerProfile)
          .findOne({
            where: { user_id: sellerId, status: SellerProfileStatus.ACTIVE },
            relations: ['default_ship_from_address'],
          });
        if (
          !seller?.default_ship_from_address ||
          seller.default_ship_from_address.deleted_at
        )
          throw new BadRequestException(errorResponse(APP_RESPONSE.NOT_ACCESS));
        const byId = new Map(lockedVariants.map((v) => [v.id, v]));
        let totalMilli = 0;
        const deductions = normalizedItems.map((input) => {
          const variant = byId.get(input.variant_id);
          if (
            !variant ||
            !Number.isInteger(input.quantity) ||
            input.quantity <= 0 ||
            variant.stock < input.quantity
          )
            throw new BadRequestException(
              errorResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID),
            );
          const list = Math.round(Number(variant.price) * 1000);
          const unit = Math.round(
            this.getVariantEffectivePrice(variant) * 1000,
          );
          const total = unit * input.quantity;
          totalMilli += total;
          return {
            input,
            variant,
            list,
            unit,
            total,
            stockBefore: variant.stock,
            stockAfter: variant.stock - input.quantity,
          };
        });
        const totalPrice = (totalMilli / 1000).toFixed(3);
        const now = new Date();
        const order = await manager.save(
          Order,
          manager.create(Order, {
            buyer_id: buyer.id,
            checkout_idempotency_key: body.idempotency_key,
            checkout_request_hash: requestHash,
            buyer_address_id: address.id,
            buyer_receiver_name: address.receiver_name,
            buyer_phone: address.phone,
            buyer_full_address: address.full_address,
            seller_id: sellerId,
            seller_address_id: seller.default_ship_from_address.id,
            seller_full_address: seller.default_ship_from_address.full_address,
            status: OrderStatus.PENDING_CONFIRMATION,
            status_changed_at: now,
            settlement_status: 'holding' as any,
            total_price: totalPrice,
            shipping_fee: '0.000',
            leatime: 0,
            note: null,
            cancel_reason: null,
            refund_reason: null,
            delivered_at: null,
            return_deadline: null,
            settled_at: null,
            media_retention_until: null,
            media_purged_at: null,
          }),
        );
        const items = await manager.save(
          OrderItem,
          deductions.map((d) =>
            manager.create(OrderItem, {
              order_id: order.id,
              product_id: d.variant.product_id,
              variant_id: d.variant.id,
              product_title_snapshot: d.variant.product.title,
              product_image_snapshot_key: this.getFirstImage(
                d.variant.product.image_urls,
              ),
              variant_snapshot: {
                size: d.variant.size,
                color: d.variant.color,
                weight: d.variant.weight,
              },
              unit_list_price: (d.list / 1000).toFixed(3),
              unit_price: (d.unit / 1000).toFixed(3),
              quantity: d.input.quantity,
              total_price: (d.total / 1000).toFixed(3),
            }),
          ),
        );
        await manager.save(
          OrderTimeline,
          manager.create(OrderTimeline, {
            order_id: order.id,
            previous_status: null,
            new_status: OrderStatus.PENDING_CONFIRMATION,
            change_source: 'system' as any,
            changed_by: null,
            note: 'Order created',
          }),
        );
        for (let i = 0; i < deductions.length; i++) {
          const d = deductions[i];
          d.variant.stock = d.stockAfter;
          await manager.save(ProductVariant, d.variant);
          await manager.save(
            InventoryMovement,
            manager.create(InventoryMovement, {
              variant_id: d.variant.id,
              order_item_id: items[i].id,
              type: InventoryMovementType.ORDER_DEDUCTED,
              quantity_delta: -d.input.quantity,
              stock_before: d.stockBefore,
              stock_after: d.stockAfter,
              idempotency_key: `ORDER_STOCK_DEDUCT:${order.id}:${d.variant.id}`,
              created_by: null,
              reason: `Stock deducted for order #${order.id}`,
            }),
          );
        }
        await manager.save(
          Shipping,
          manager.create(Shipping, {
            order_id: order.id,
            shipper_id: null,
            status: 'pending',
            tracking_code: null,
          }),
        );
        await this.walletLedgerService.applyOperation(manager, {
          type: WalletOperationType.ORDER_PAYMENT,
          referenceType: WalletReferenceType.ORDER,
          referenceId: order.id,
          idempotencyKey: `ORDER_PAYMENT:${order.id}`,
          description: `Payment for order #${order.id}`,
          entries: [
            {
              userId: buyer.id,
              bucket: WalletBalanceBucket.AVAILABLE,
              direction: WalletEntryDirection.DEBIT,
              amount: totalPrice,
            },
            {
              userId: sellerId,
              bucket: WalletBalanceBucket.PENDING,
              direction: WalletEntryDirection.CREDIT,
              amount: totalPrice,
            },
          ],
        });
        return buildResponse(APP_RESPONSE.OK, {
          order_id: order.id,
          status: order.status,
          total_price: Number(order.total_price),
          shipping_fee: 0,
          final_price: Number(order.total_price),
          address_id: address.id,
          order_source: orderSource,
          source: orderSource,
        });
      });
    } catch (error) {
      const replay = await this.orderRepository.findOne({
        where: {
          buyer_id: buyer.id,
          checkout_idempotency_key: body.idempotency_key,
        },
      });
      if (replay) {
        if (replay.checkout_request_hash !== requestHash)
          throw new BadRequestException(
            'idempotency_key đã được dùng cho payload checkout khác.',
          );
        return buildResponse(APP_RESPONSE.OK, {
          order_id: replay.id,
          status: replay.status,
          total_price: Number(replay.total_price),
          shipping_fee: Number(replay.shipping_fee),
          final_price: this.getOrderAmount(replay),
        });
      }
      throw error;
    }
  }

  async getListPurchasesSeller(
    body: GetListPurchasesSellerDto,
    userId: string,
  ) {
    const seller = await this.sellerProfileRepository.findOne({
      where: { user_id: userId, status: SellerProfileStatus.ACTIVE },
    });

    if (!seller) {
      throw new UnauthorizedException(
        errorResponse(APP_RESPONSE.TOKEN_INVALID),
      );
    }

    const index = body.index ?? 0;
    const count = body.count ?? 10;

    if (isNaN(index) || isNaN(count) || index < 0 || count <= 0) {
      throw new BadRequestException(
        errorResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID),
      );
    }

    const query = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'item')
      .where('order.seller_id = :sellerId', { sellerId: seller.user_id });

    if (body.state) {
      query.andWhere('order.status = :state', { state: body.state });
    }

    const orders = await query
      .orderBy('order.created_at', 'DESC')
      .skip(index)
      .take(count)
      .getMany();

    const data = orders.map((order) => ({
      id: order.id,
      state: order.status,
      total_price: Number(order.total_price),
      items: (order.items || []).map((item) => ({
        product_id: item.product_id,
        name: item.product_title_snapshot,
        image: item.product_image_snapshot_key,
        price: Number(item.unit_price),
        variant_id: item.variant_id,
        quantity: item.quantity,
      })),
      buyerId: order.buyer_id,
    }));

    return buildResponse(APP_RESPONSE.OK, data);
  }

  async getListPurchases(body: GetListPurchasesDto, userId: string) {
    const buyer = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!buyer) {
      throw new UnauthorizedException(
        errorResponse(APP_RESPONSE.TOKEN_INVALID),
      );
    }

    const index = body.index ?? 0;
    const count = body.count ?? 10;

    if (isNaN(index) || isNaN(count) || index < 0 || count <= 0) {
      throw new BadRequestException(
        errorResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID),
      );
    }

    const query = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'item')
      .where('order.buyer_id = :buyerId', { buyerId: buyer.id });

    if (body.state) {
      query.andWhere('order.status = :state', { state: body.state });
    }

    const orders = await query
      .orderBy('order.created_at', 'DESC')
      .skip(index)
      .take(count)
      .getMany();

    const data = orders.map((order) => ({
      id: order.id,
      state: order.status,
      total_price: Number(order.total_price),
      items: (order.items || []).map((item) => ({
        product_id: item.product_id,
        name: item.product_title_snapshot,
        image: item.product_image_snapshot_key,
        price: Number(item.unit_price),
        variant_id: item.variant_id,
        quantity: item.quantity,
      })),
    }));

    return buildResponse(APP_RESPONSE.OK, data);
  }

  async getCart(userId: string) {
    const buyer = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!buyer) {
      throw new UnauthorizedException(
        errorResponse(APP_RESPONSE.TOKEN_INVALID),
      );
    }

    const cartItems = await this.cartItemRepository.find({
      where: { user_id: buyer.id },
      relations: [
        'variant',
        'variant.product',
        'variant.product.seller_profile',
        'variant.product.seller_profile.user',
      ],
      order: { updated_at: 'DESC', id: 'DESC' },
    });

    const shopMap = new Map<
      string,
      {
        shop_id: string;
        shop_name: string;
        shop_avatar: string;
        items: {
          cart_item_id: string;
          product_id: string;
          variant_id: string;
          name: string;
          image: string;
          price: string;
          quantity: number;
          subtotal: string;
        }[];
        shop_total: string;
      }
    >();

    for (const cartItem of cartItems) {
      const product = cartItem.variant?.product;

      if (!product) {
        continue;
      }

      const sellerProfile = product.seller_profile;
      const seller = sellerProfile?.user;
      const shopId = product.seller_id;
      const price = this.getVariantEffectivePrice(cartItem.variant);
      const subtotal = price * cartItem.quantity;

      if (!shopMap.has(shopId)) {
        shopMap.set(shopId, {
          shop_id: shopId,
          shop_name:
            sellerProfile?.shop_name ||
            seller?.fullname ||
            seller?.username ||
            '',
          shop_avatar: seller?.avatar || '',
          items: [],
          shop_total: '0',
        });
      }

      const shop = shopMap.get(shopId)!;

      shop.items.push({
        cart_item_id: cartItem.id,
        product_id: product.id,
        variant_id: cartItem.variant_id,
        name: product.title || '',
        image: this.getFirstImage(product.image_urls),
        price: this.formatMoney(price),
        quantity: cartItem.quantity,
        subtotal: this.formatMoney(subtotal),
      });

      shop.shop_total = this.formatMoney(Number(shop.shop_total) + subtotal);
    }

    return buildResponse(APP_RESPONSE.OK, Array.from(shopMap.values()));
  }

  async addCart(userId: string, body: AddCartDto) {
    const buyer = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!buyer) {
      throw new UnauthorizedException(
        errorResponse(APP_RESPONSE.TOKEN_INVALID),
      );
    }

    const product = await this.productRepository.findOne({
      where: { id: body.product_id },
    });

    if (!product) {
      return buildResponse(APP_RESPONSE.PRODUCT_NOT_EXISTED, null);
    }

    const variant = await this.productVariantRepository.findOne({
      where: {
        id: body.variant_id,
        product_id: product.id,
      },
      relations: ['product'],
    });

    if (!variant) {
      return buildResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID, null);
    }

    let cartItem = await this.cartItemRepository.findOne({
      where: {
        user_id: buyer.id,
        variant_id: variant.id,
      },
    });

    if (cartItem) {
      cartItem.quantity += body.quantity;
    } else {
      cartItem = this.cartItemRepository.create({
        user_id: buyer.id,
        variant_id: variant.id,
        quantity: body.quantity,
      });
    }

    const savedCartItem = await this.cartItemRepository.save(cartItem);
    const subtotal =
      this.getVariantEffectivePrice(variant) * savedCartItem.quantity;

    return buildResponse(APP_RESPONSE.OK, {
      cart_item_id: savedCartItem.id,
      product_id: product.id,
      variant_id: savedCartItem.variant_id,
      quantity: savedCartItem.quantity,
      subtotal: this.formatMoney(subtotal),
    });
  }

  async editCart(userId: string, body: EditCartDto) {
    const buyer = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!buyer) {
      throw new UnauthorizedException(
        errorResponse(APP_RESPONSE.TOKEN_INVALID),
      );
    }

    const cartItem = await this.cartItemRepository.findOne({
      where: {
        id: body.cart_item_id,
        user_id: buyer.id,
      },
      relations: ['variant', 'variant.product'],
    });

    if (!cartItem || !cartItem.variant?.product) {
      return buildResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID, null);
    }

    cartItem.quantity = body.quantity;
    const savedCartItem = await this.cartItemRepository.save(cartItem);
    const subtotal =
      this.getVariantEffectivePrice(cartItem.variant) * savedCartItem.quantity;

    return buildResponse(APP_RESPONSE.OK, {
      cart_item_id: savedCartItem.id,
      quantity: savedCartItem.quantity,
      subtotal: this.formatMoney(subtotal),
    });
  }

  async deleteCart(userId: string, body: DeleteCartDto) {
    const buyer = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!buyer) {
      throw new UnauthorizedException(
        errorResponse(APP_RESPONSE.TOKEN_INVALID),
      );
    }

    const cartItem = await this.cartItemRepository.findOne({
      where: {
        id: body.cart_item_id,
        user_id: buyer.id,
      },
    });

    if (!cartItem) {
      return buildResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID, null);
    }

    await this.cartItemRepository.delete(cartItem.id);

    return buildResponse(APP_RESPONSE.OK, null);
  }

  async findAll() {
    return await this.orderAddressRepository.find();
  }

  async getShipFrom(query: GetShipFromQueryDto, userId: string) {
    const { level, index, count, parent_id } = query;
    const leveldefault = level ?? 2;
    if (index === undefined || count === undefined || parent_id === undefined) {
      return APP_RESPONSE.PARAMETER_NOT_ENOUGH;
    }

    const levelNum = leveldefault;
    const indexNum = index;
    const countNum = count;
    const parentId = parent_id;

    if (
      isNaN(indexNum) ||
      isNaN(countNum) ||
      isNaN(levelNum)
    ) {
      return APP_RESPONSE.PARAMETER_VALUE_INVALID;
    }

    if (indexNum < 0 || countNum <= 0) {
      return APP_RESPONSE.PARAMETER_VALUE_INVALID;
    }
    if (!userId || !isCanonicalPositiveIntegerString(parentId)) {
      return APP_RESPONSE.PARAMETER_VALUE_INVALID;
    }
    if (leveldefault == 1) {
      const province = await this.provinceRepository.findOne({
        where: { id: parent_id },
      });
      if (!province) {
        return APP_RESPONSE.PARAMETER_VALUE_INVALID;
      }
    } else {
      const ward = await this.wardRepository.findOne({
        where: { id: parent_id },
      });
      if (!ward) {
        return APP_RESPONSE.PARAMETER_VALUE_INVALID;
      }
    }
    if (index < 0) {
      return APP_RESPONSE.PARAMETER_VALUE_INVALID;
    }
    const queryBuilder = this.addressRepository
      .createQueryBuilder('address')
      .leftJoinAndSelect('address.ward', 'ward')
      .leftJoinAndSelect('ward.province', 'province')
      .where('address.user_id = :userId', { userId })
      .andWhere('address.deleted_at IS NULL');
    if (leveldefault == 1) {
      queryBuilder.andWhere('ward.province_id = :provinceId', {
        provinceId: parentId,
      });
    } else {
      queryBuilder.andWhere('address.ward_id = :wardId', {
        wardId: parentId,
      });
    }

    const offset = indexNum * countNum;
    const [addresses] = await queryBuilder
      .orderBy('address.is_default', 'DESC')
      .addOrderBy('address.id', 'DESC')
      .skip(offset)
      .take(countNum)
      .getManyAndCount();
    const listAddress = addresses.map((address) => ({
      id: address.id,
      name: address.address_name || address.full_address,
      full_address: address.full_address,
      receiver_name: address.receiver_name,
      phone: address.phone,
      is_default: address.is_default ? '1' : '0',
    }));
    return buildResponse(APP_RESPONSE.OK, listAddress);
  }

  async getShipFee(user_id: string, query: GetShipFeeDto) {
    if (!user_id) {
      return APP_RESPONSE.TOKEN_INVALID;
    }

    const { product_id, address_id } = query;

    if (product_id === undefined || product_id === null) {
      return APP_RESPONSE.PARAMETER_NOT_ENOUGH;
    }

    if (!isCanonicalPositiveIntegerString(product_id)) {
      return APP_RESPONSE.PARAMETER_VALUE_INVALID;
    }

    const product = await this.productRepository.findOne({
      where: { id: product_id },
      relations: ['ship_from'],
    });

    if (!product || !product.ship_from) {
      return APP_RESPONSE.PARAMETER_VALUE_INVALID;
    }

    let addressId: string | null = null;

    if (address_id !== undefined && address_id !== null) {
      if (!isCanonicalPositiveIntegerString(address_id)) {
        return APP_RESPONSE.PARAMETER_VALUE_INVALID;
      }
      addressId = address_id;
    }

    let buyerAddress: OrderAddress | null = null;

    if (addressId !== null) {
      buyerAddress = await this.orderAddressRepository.findOne({
        where: {
          id: addressId,
          user_id,
        },
      });
    } else {
      buyerAddress = await this.orderAddressRepository.findOne({
        where: {
          user_id,
          is_default: true,
        },
      });
    }

    if (!buyerAddress) {
      return APP_RESPONSE.PARAMETER_VALUE_INVALID;
    }

    return buildResponse(APP_RESPONSE.OK, {
      ship_fee: 0,
      shipping_fee: 0,
      leatime: 0,
      distance: null,
    });
  }

  async getListOrderAddress(user_id: string) {
    return this.addressesService.getMyAddresses(user_id);
  }

  async addOrderAddress(user_id: string, query: AddOrderAddressDto) {
    if (!user_id) {
      return APP_RESPONSE.TOKEN_INVALID;
    }

    if (!query) {
      return APP_RESPONSE.PARAMETER_NOT_ENOUGH;
    }

    const {
      address,
      is_default = false,
      address_id,
      receiver_name,
      phone,
      address_detail,
    } = query;

    if (!Array.isArray(address_id) || address_id.length < 2) {
      return APP_RESPONSE.PARAMETER_NOT_ENOUGH;
    }

    const [ward_id, province_id] = address_id;

    if (!ward_id || !province_id) {
      return APP_RESPONSE.PARAMETER_NOT_ENOUGH;
    }

    if (
      !isCanonicalPositiveIntegerString(ward_id) ||
      !isCanonicalPositiveIntegerString(province_id)
    ) {
      return APP_RESPONSE.PARAMETER_VALUE_INVALID;
    }

    if (!address_detail?.trim() || !receiver_name?.trim() || !phone?.trim()) {
      return APP_RESPONSE.PARAMETER_VALUE_INVALID;
    }

    return this.addressesService.createAddress(user_id, {
      province_id,
      ward_id,
      address_name: address,
      address_detail,
      receiver_name,
      phone,
      is_default,
    });
  }

  async editOrderAddress(
    user_id: string,
    id: string,
    query: UpdateOrderAddressDto,
  ) {
    if (!isCanonicalPositiveIntegerString(id))
      return APP_RESPONSE.PARAMETER_VALUE_INVALID;
    const { is_default } = query;
    if (!user_id) {
      return APP_RESPONSE.TOKEN_INVALID;
    }
    if (is_default !== true) return APP_RESPONSE.PARAMETER_VALUE_INVALID;

    return this.addressesService.setDefaultAddress(user_id, id);
  }

  async delete_order_address(user_id: string, id: string) {
    return this.addressesService.deleteAddress(user_id, id);
  }

  async get_order_status(user_id: string, query: GetOrderStatusDto) {
    if (!user_id) {
      return APP_RESPONSE.TOKEN_INVALID;
    }
    const { purchase_id } = query;
    const purchase = await this.orderRepository.findOne({
      where: { id: purchase_id },
    });
    if (!purchase) {
      return APP_RESPONSE.PARAMETER_VALUE_INVALID;
    }
    const order = await this.orderRepository.findOne({
      where: { id: purchase_id },
      relations: [
        'items',
        'shipping',
        'seller_address',
        'seller_address.ward',
        'seller_address.ward.province',
        'buyer_address',
        'buyer_address.ward',
        'buyer_address.ward.province',
        'timelines',
      ],
      withDeleted: true,
    });
    if (!order) {
      return APP_RESPONSE.PARAMETER_VALUE_INVALID;
    }
    const full_addr_seller = order.seller_full_address;
    const full_addr_buyer = order.buyer_full_address;

    return buildResponse(APP_RESPONSE.OK, {
      id: order.id,
      ship_from: full_addr_seller,
      ship_to: full_addr_buyer,
      price: order.total_price,
      ship_fee: order.shipping_fee,
      create: order.created_at,
      leatime: order.leatime,
      current_status: order.status,
      status_history: order.timelines || [],
      products: order.items.map((item) => ({
        id: item.product_id,
        name: item.product_title_snapshot,
        price: Number(item.unit_price),
        variant_id: item.variant_id,
        image: item.product_image_snapshot_key,
        video: [],
      })),
    });
  }

  private calculateShipFeeByDistance(distance: number) {
    let ship_fee = 0;
    let leatime = 0;

    if (distance < 15) {
      ship_fee = 20000;
      leatime = 24;
    } else if (distance >= 15 && distance <= 100) {
      ship_fee = 30000;
      leatime = 36;
    } else if (distance > 100 && distance < 500) {
      ship_fee = 44000;
      leatime = 72;
    } else {
      ship_fee = 55000;
      leatime = 120;
    }

    return { ship_fee, leatime };
  }

  private async calculateShipFeeForOrder(
    productId: string,
    buyerAddressId: string,
    userId: string,
  ) {
    const product = await this.productRepository.findOne({
      where: { id: productId },
    });

    if (!product) {
      throw new BadRequestException(
        errorResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID),
      );
    }

    const buyerAddress = await this.orderAddressRepository.findOne({
      where: {
        id: buyerAddressId,
        user_id: userId,
      },
    });

    if (!buyerAddress) {
      throw new BadRequestException(
        errorResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID),
      );
    }

    // Shipping is intentionally disabled in the current version.
    return { ship_fee: 0, leatime: 0 };
  }

  async getProvinces() {
    const provinces = await this.provinceRepository.find({
      order: { name: 'ASC' },
    });

    return buildResponse(
      APP_RESPONSE.OK,
      provinces.map((province) => ({
        id: province.id,
        name: province.name,
      })),
    );
  }

  async getWardsByProvince(provinceId: string) {
    if (!isCanonicalPositiveIntegerString(provinceId)) {
      return APP_RESPONSE.PARAMETER_VALUE_INVALID;
    }

    const province = await this.provinceRepository.findOne({
      where: { id: provinceId },
    });

    if (!province) {
      return APP_RESPONSE.PARAMETER_VALUE_INVALID;
    }

    const wards = await this.wardRepository.find({
      where: { province_id: provinceId },
      order: { name: 'ASC' },
    });

    return buildResponse(
      APP_RESPONSE.OK,
      wards.map((ward) => ({
        id: ward.id,
        name: ward.name,
        province_id: ward.province_id,
      })),
    );
  }

  private getFirstImage(imageUrls?: string[] | string | null): string {
    if (!imageUrls) return '';

    if (Array.isArray(imageUrls)) {
      return imageUrls.length > 0 ? imageUrls[0] : '';
    }

    try {
      const parsed = JSON.parse(imageUrls);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed[0];
      }
    } catch (_) {}

    return imageUrls;
  }

  private formatMoney(value: number): string {
    return (value || 0).toString();
  }

  async getPurchase(body: GetPurchaseDto, userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException(
        errorResponse(APP_RESPONSE.TOKEN_INVALID),
      );
    }

    const purchaseId = body.id;

    if (!isCanonicalPositiveIntegerString(purchaseId)) {
      throw new BadRequestException(
        errorResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID),
      );
    }

    const order = await this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'item')
      .leftJoinAndSelect('order.buyer', 'buyer')
      .leftJoinAndSelect('order.seller_profile', 'seller_profile')
      .leftJoinAndSelect('seller_profile.user', 'seller')
      .leftJoinAndSelect('order.shipping', 'shipping')
      .where('order.id = :purchaseId', { purchaseId })
      .andWhere('(order.buyer_id = :userId OR order.seller_id = :userId)', {
        userId: user.id,
      })
      .getOne();

    if (!order) {
      throw new BadRequestException(
        errorResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID),
      );
    }

    let buyerAddress = '';

    buyerAddress = order.buyer_full_address;

    const totalPrice = Number(order.total_price || 0);
    const shipFee = Number(order.shipping_fee || 0);
    const finalPrice = totalPrice + shipFee;

    return buildResponse(APP_RESPONSE.OK, {
      id: order.id,
      state: order.status,
      total_price: totalPrice,
      ship_fee: shipFee,
      final_price: finalPrice,
      note: order.note || '',
      items: (order.items || []).map((item) => ({
        product_id: item.product_id,
        name: item.product_title_snapshot,
        image: item.product_image_snapshot_key,
        price: Number(item.unit_price),
        variant_id: item.variant_id,
        quantity: item.quantity,
        subtotal: Number(item.total_price || 0),
      })),
      seller: {
        id: order.seller_profile?.user?.id || null,
        name:
          order.seller_profile?.shop_name ||
          order.seller_profile?.user?.username ||
          '',
      },
      buyer: {
        id: order.buyer?.id || null,
        name: order.buyer?.username || '',
        phonenumber: order.buyer?.phone_number || '',
        address: buyerAddress,
      },
    });
  }

  async editPurchase(body: EditPurchaseDto, userId: string) {
    const buyer = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!buyer) {
      throw new UnauthorizedException(
        errorResponse(APP_RESPONSE.TOKEN_INVALID),
      );
    }

    const purchaseId = body.id;

    if (!isCanonicalPositiveIntegerString(purchaseId)) {
      throw new BadRequestException(
        errorResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID),
      );
    }

    const order = await this.orderRepository.findOne({
      where: {
        id: purchaseId,
        buyer_id: buyer.id,
      },
      relations: ['shipping'],
    });

    if (!order) {
      throw new BadRequestException(
        errorResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID),
      );
    }

    if (
      order.status !== OrderStatus.PENDING_CONFIRMATION &&
      order.status !== OrderStatus.CONFIRMED
    ) {
      throw new BadRequestException(
        errorResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID),
      );
    }

    if (body.address_id) {
      const addressId = body.address_id;

      if (!isCanonicalPositiveIntegerString(addressId)) {
        throw new BadRequestException(
          errorResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID),
        );
      }

      const address = await this.addressRepository.findOne({
        where: {
          id: addressId,
          user_id: buyer.id,
        },
      });

      if (!address) {
        throw new BadRequestException(
          errorResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID),
        );
      }

      throw new BadRequestException(
        'Địa chỉ đơn hàng đã được snapshot và không thể thay đổi sau checkout.',
      );
    }

    if (body.note !== undefined) {
      order.note = body.note;
      await this.orderRepository.save(order);
    }

    return buildResponse(APP_RESPONSE.OK, {
      id: order.id,
      state: order.status,
      note: order.note || '',
      address_id: order.buyer_address_id,
      address: order.buyer_full_address,
    });
  }

  async cancelOrder(body: CancelOrderDto, userId: string) {
    const buyer = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!buyer) {
      throw new UnauthorizedException(
        errorResponse(APP_RESPONSE.TOKEN_INVALID),
      );
    }

    const purchaseId = body.id;

    if (!isCanonicalPositiveIntegerString(purchaseId)) {
      throw new BadRequestException(
        errorResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID),
      );
    }

    const order = await this.orderRepository.findOne({
      where: {
        id: purchaseId,
        buyer_id: buyer.id,
      },
    });

    if (!order) {
      throw new BadRequestException(
        errorResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID),
      );
    }

    if (
      order.status !== OrderStatus.PENDING_CONFIRMATION &&
      order.status !== OrderStatus.CONFIRMED
    ) {
      throw new BadRequestException(
        errorResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID),
      );
    }

    try {
      return await this.dataSource.transaction(async (manager) => {
        const lockedOrder = await manager
          .getRepository(Order)
          .createQueryBuilder('order')
          .where('order.id = :orderId', { orderId: purchaseId })
          .andWhere('order.buyer_id = :buyerId', { buyerId: buyer.id })
          .setLock('pessimistic_write')
          .getOne();

        if (
          !lockedOrder ||
          (lockedOrder.status !== OrderStatus.PENDING_CONFIRMATION &&
            lockedOrder.status !== OrderStatus.CONFIRMED)
        ) {
          throw new BadRequestException(
            errorResponse(APP_RESPONSE.ACTION_DONE_PREVIOUSLY),
          );
        }

        const refundedCoins = this.getOrderAmount(lockedOrder);

        const previousStatus = lockedOrder.status;
        lockedOrder.status = OrderStatus.CANCELLED;
        lockedOrder.status_changed_at = new Date();
        lockedOrder.settlement_status = SettlementStatus.REFUNDED;
        lockedOrder.settled_at = new Date();
        lockedOrder.media_retention_until = new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000,
        );
        lockedOrder.cancel_reason = body.reason ?? null;
        await manager.save(Order, lockedOrder);

        await this.restoreOrderStock(
          manager,
          lockedOrder.id,
          body.reason ?? 'Buyer cancelled order',
        );

        await this.walletLedgerService.applyOperation(manager, {
          type: WalletOperationType.ORDER_REFUND,
          referenceType: WalletReferenceType.ORDER,
          referenceId: lockedOrder.id,
          idempotencyKey: `ORDER_REFUND:CANCEL:${lockedOrder.id}`,
          description: `Refund for cancelled order #${lockedOrder.id}`,
          entries: [
            {
              userId: lockedOrder.buyer_id,
              bucket: WalletBalanceBucket.AVAILABLE,
              direction: WalletEntryDirection.CREDIT,
              amount: refundedCoins,
            },
            {
              userId: lockedOrder.seller_id,
              bucket: WalletBalanceBucket.PENDING,
              direction: WalletEntryDirection.DEBIT,
              amount: refundedCoins,
            },
          ],
        });

        const timeline = manager.create(OrderTimeline, {
          order_id: lockedOrder.id,
          previous_status: previousStatus,
          new_status: OrderStatus.CANCELLED,
          change_source: 'buyer' as any,
          changed_by: buyer.id,
          note: body.reason ?? 'Buyer cancelled order',
        });

        await manager.save(OrderTimeline, timeline);

        return buildResponse(APP_RESPONSE.OK, {
          id: lockedOrder.id,
          state: lockedOrder.status,
          cancel_reason: lockedOrder.cancel_reason,
          refunded_coins: refundedCoins,
          refunded_at: new Date(),
        });
      });
    } catch (error) {
      console.error('Cancel order error:', error);
      throw error;
    }
  }

  async setAcceptBuyer(body: SetAcceptBuyerDto, userId: string) {
    const seller = await this.sellerProfileRepository.findOne({
      where: { user_id: userId, status: SellerProfileStatus.ACTIVE },
    });

    if (!seller) {
      throw new BadRequestException(errorResponse(APP_RESPONSE.NOT_ACCESS));
    }

    const purchaseId = body.purchase_id;
    const buyerId = body.buyer_id;
    const isAccept = body.is_accept;

    if (
      !isCanonicalPositiveIntegerString(purchaseId) ||
      !/^\d+$/.test(buyerId) ||
      (isAccept !== 0 && isAccept !== 1)
    ) {
      throw new BadRequestException(
        errorResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID),
      );
    }

    const buyer = await this.userRepository.findOne({
      where: { id: buyerId },
    });

    if (!buyer) {
      throw new BadRequestException(errorResponse(APP_RESPONSE.USER_NOT_EXIST));
    }

    const order = await this.orderRepository.findOne({
      where: {
        id: purchaseId,
        buyer_id: buyerId,
        seller_id: seller.user_id,
      },
    });

    if (!order) {
      throw new BadRequestException(
        errorResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID),
      );
    }

    if (order.status !== OrderStatus.PENDING_CONFIRMATION) {
      throw new BadRequestException(
        errorResponse(APP_RESPONSE.ACTION_DONE_PREVIOUSLY),
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const lockedOrder = await manager
        .getRepository(Order)
        .createQueryBuilder('order')
        .where('order.id = :orderId', { orderId: purchaseId })
        .andWhere('order.buyer_id = :buyerId', { buyerId: buyerId })
        .andWhere('order.seller_id = :sellerId', { sellerId: seller.user_id })
        .setLock('pessimistic_write')
        .getOne();

      if (
        !lockedOrder ||
        lockedOrder.status !== OrderStatus.PENDING_CONFIRMATION
      ) {
        throw new BadRequestException(
          errorResponse(APP_RESPONSE.ACTION_DONE_PREVIOUSLY),
        );
      }

      const previousStatus = lockedOrder.status;
      const newStatus =
        isAccept === 1 ? OrderStatus.CONFIRMED : OrderStatus.CANCELLED;

      lockedOrder.status = newStatus;
      lockedOrder.status_changed_at = new Date();
      if (isAccept === 0) {
        lockedOrder.settlement_status = SettlementStatus.REFUNDED;
        lockedOrder.settled_at = new Date();
        lockedOrder.media_retention_until = new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000,
        );
      }
      await manager.save(Order, lockedOrder);

      if (isAccept === 0) {
        const refundedCoins = this.getOrderAmount(lockedOrder);

        await this.walletLedgerService.applyOperation(manager, {
          type: WalletOperationType.ORDER_REFUND,
          referenceType: WalletReferenceType.ORDER,
          referenceId: lockedOrder.id,
          idempotencyKey: `ORDER_REFUND:SELLER_REJECT:${lockedOrder.id}`,
          description: `Refund for rejected order #${lockedOrder.id}`,
          entries: [
            {
              userId: lockedOrder.buyer_id,
              bucket: WalletBalanceBucket.AVAILABLE,
              direction: WalletEntryDirection.CREDIT,
              amount: refundedCoins,
            },
            {
              userId: lockedOrder.seller_id,
              bucket: WalletBalanceBucket.PENDING,
              direction: WalletEntryDirection.DEBIT,
              amount: refundedCoins,
            },
          ],
        });

        await this.restoreOrderStock(
          manager,
          lockedOrder.id,
          'Seller rejected order',
        );
      }

      await this.addTimeline(
        lockedOrder.id,
        lockedOrder.status,
        isAccept === 1 ? 'Seller accepted order' : 'Seller rejected order',
        manager,
        previousStatus,
        OrderStatusChangeSource.SELLER,
        userId,
      );

      return APP_RESPONSE.OK;
    });
  }

  async buyerConfirmReceived(body: BuyerConfirmReceivedDto, userId: string) {
    const buyer = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!buyer) {
      throw new UnauthorizedException(
        errorResponse(APP_RESPONSE.TOKEN_INVALID),
      );
    }

    const purchaseId = body.purchase_id;

    if (!isCanonicalPositiveIntegerString(purchaseId)) {
      throw new BadRequestException(
        errorResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID),
      );
    }

    const order = await this.orderRepository.findOne({
      where: {
        id: purchaseId,
        buyer_id: buyer.id,
      },
    });

    if (!order) {
      throw new BadRequestException(
        errorResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID),
      );
    }

    if (order.status !== OrderStatus.SHIPPING) {
      throw new BadRequestException(
        errorResponse(APP_RESPONSE.ACTION_DONE_PREVIOUSLY),
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const lockedOrder = await manager
        .getRepository(Order)
        .createQueryBuilder('order')
        .where('order.id = :orderId', { orderId: purchaseId })
        .andWhere('order.buyer_id = :buyerId', { buyerId: buyer.id })
        .setLock('pessimistic_write')
        .getOne();

      if (!lockedOrder || lockedOrder.status !== OrderStatus.SHIPPING) {
        throw new BadRequestException(
          errorResponse(APP_RESPONSE.ACTION_DONE_PREVIOUSLY),
        );
      }

      const deliveredAt = new Date();
      lockedOrder.status = OrderStatus.DELIVERED;
      lockedOrder.status_changed_at = deliveredAt;
      lockedOrder.delivered_at = deliveredAt;
      lockedOrder.return_deadline = new Date(
        deliveredAt.getTime() + 7 * 24 * 60 * 60 * 1000,
      );
      await manager.save(Order, lockedOrder);

      await this.addTimeline(
        lockedOrder.id,
        OrderStatus.DELIVERED,
        'Buyer confirmed received; seller points remain pending until the return window expires',
        manager,
        OrderStatus.SHIPPING,
        OrderStatusChangeSource.BUYER,
        buyer.id,
      );

      return APP_RESPONSE.OK;
    });
  }

  async refundOrder(body: RefundOrderDto, userId: string) {
    const buyer = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!buyer) {
      throw new UnauthorizedException(
        errorResponse(APP_RESPONSE.TOKEN_INVALID),
      );
    }

    const purchaseId = body.purchase_id;

    if (!isCanonicalPositiveIntegerString(purchaseId)) {
      throw new BadRequestException(
        errorResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID),
      );
    }

    const order = await this.orderRepository.findOne({
      where: {
        id: purchaseId,
        buyer_id: buyer.id,
      },
    });

    if (!order) {
      throw new BadRequestException(
        errorResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID),
      );
    }

    if (
      order.status !== OrderStatus.DELIVERED ||
      (order.return_deadline && new Date() > order.return_deadline)
    ) {
      throw new BadRequestException(
        errorResponse(APP_RESPONSE.ACTION_DONE_PREVIOUSLY),
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const lockedOrder = await manager
        .getRepository(Order)
        .createQueryBuilder('order')
        .where('order.id = :orderId', { orderId: purchaseId })
        .andWhere('order.buyer_id = :buyerId', { buyerId: buyer.id })
        .setLock('pessimistic_write')
        .getOne();

      if (
        !lockedOrder ||
        lockedOrder.status !== OrderStatus.DELIVERED ||
        (lockedOrder.return_deadline &&
          new Date() > lockedOrder.return_deadline)
      ) {
        throw new BadRequestException(
          errorResponse(APP_RESPONSE.ACTION_DONE_PREVIOUSLY),
        );
      }

      const alreadyRequested = await manager
        .getRepository(Refund)
        .findOne({ where: { order_id: lockedOrder.id } });
      if (alreadyRequested)
        return buildResponse(APP_RESPONSE.OK, {
          refund_id: alreadyRequested.id,
          status: alreadyRequested.status,
        });
      const deadline = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      const refund = await manager.save(
        Refund,
        manager.create(Refund, {
          order_id: lockedOrder.id,
          requested_by: buyer.id,
          amount: lockedOrder.total_price,
          reason: body.reason ?? null,
          status: RefundStatus.REQUESTED,
          decision_source: null,
          responded_by: null,
          seller_response: null,
          seller_response_deadline: deadline,
          responded_at: null,
          completed_at: null,
        }),
      );
      lockedOrder.settlement_status = 'refund_requested' as any;
      lockedOrder.refund_reason = body.reason ?? null;
      await manager.save(Order, lockedOrder);
      return buildResponse(APP_RESPONSE.OK, {
        refund_id: refund.id,
        status: refund.status,
        seller_response_deadline: deadline,
      });
    });
  }

  async sellerMarkAsShipped(body: SellerMarkAsShippedDto, userId: string) {
    const seller = await this.sellerProfileRepository.findOne({
      where: { user_id: userId, status: SellerProfileStatus.ACTIVE },
    });

    if (!seller) {
      throw new BadRequestException(errorResponse(APP_RESPONSE.NOT_ACCESS));
    }

    const purchaseId = body.purchase_id;
    const buyerId = body.buyer_id;

    if (
      !isCanonicalPositiveIntegerString(purchaseId) ||
      !/^\d+$/.test(buyerId)
    ) {
      throw new BadRequestException(
        errorResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID),
      );
    }

    const buyer = await this.userRepository.findOne({
      where: { id: buyerId },
    });

    if (!buyer) {
      throw new BadRequestException(errorResponse(APP_RESPONSE.USER_NOT_EXIST));
    }

    const order = await this.orderRepository.findOne({
      where: {
        id: purchaseId,
        buyer_id: buyerId,
        seller_id: seller.user_id,
      },
    });

    if (!order) {
      throw new BadRequestException(
        errorResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID),
      );
    }

    if (order.status !== OrderStatus.CONFIRMED) {
      throw new BadRequestException(
        errorResponse(APP_RESPONSE.ACTION_DONE_PREVIOUSLY),
      );
    }

    await this.dataSource.transaction(async (manager) => {
      const lockedOrder = await manager
        .getRepository(Order)
        .createQueryBuilder('order')
        .where('order.id = :orderId', { orderId: purchaseId })
        .andWhere('order.seller_id = :sellerId', { sellerId: seller.user_id })
        .andWhere('order.buyer_id = :buyerId', { buyerId })
        .setLock('pessimistic_write')
        .getOne();
      if (!lockedOrder || lockedOrder.status !== OrderStatus.CONFIRMED)
        throw new BadRequestException(
          errorResponse(APP_RESPONSE.ACTION_DONE_PREVIOUSLY),
        );
      lockedOrder.status = OrderStatus.SHIPPING;
      lockedOrder.status_changed_at = new Date();
      await manager.save(Order, lockedOrder);
      await this.addTimeline(
        lockedOrder.id,
        OrderStatus.SHIPPING,
        'Seller marked as shipped',
        manager,
        OrderStatus.CONFIRMED,
        OrderStatusChangeSource.SELLER,
        userId,
      );
    });

    return APP_RESPONSE.OK;
  }

  async respondRefund(body: RespondRefundDto, userId: string) {
    const purchaseId = body.purchase_id;
    if (
      !isCanonicalPositiveIntegerString(purchaseId) ||
      ![0, 1].includes(body.is_accept)
    ) {
      throw new BadRequestException(
        errorResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID),
      );
    }
    return this.dataSource.transaction(async (manager) => {
      const order = await manager
        .getRepository(Order)
        .createQueryBuilder('order')
        .where('order.id = :purchaseId AND order.seller_id = :sellerId', {
          purchaseId,
          sellerId: userId,
        })
        .setLock('pessimistic_write')
        .getOne();
      if (
        !order ||
        order.status !== OrderStatus.DELIVERED ||
        order.settlement_status !== SettlementStatus.REFUND_REQUESTED
      )
        throw new BadRequestException(
          errorResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID),
        );
      const refund = await manager
        .getRepository(Refund)
        .createQueryBuilder('refund')
        .where('refund.order_id = :purchaseId', { purchaseId })
        .setLock('pessimistic_write')
        .getOne();
      if (!refund || refund.status !== RefundStatus.REQUESTED)
        throw new BadRequestException(
          errorResponse(APP_RESPONSE.ACTION_DONE_PREVIOUSLY),
        );
      if (new Date() > refund.seller_response_deadline) {
        refund.status = RefundStatus.ACCEPTED;
        refund.decision_source = RefundDecisionSource.SYSTEM_TIMEOUT;
        refund.responded_by = null;
        refund.responded_at = new Date();
        await this.completeRefundSettlement(manager, order, refund);
        return buildResponse(APP_RESPONSE.OK, {
          refund_id: refund.id,
          status: refund.status,
          decision_source: refund.decision_source,
        });
      }
      refund.status =
        body.is_accept === 1 ? RefundStatus.ACCEPTED : RefundStatus.REJECTED;
      refund.decision_source = RefundDecisionSource.SELLER;
      refund.responded_by = userId;
      refund.seller_response = body.seller_response ?? null;
      refund.responded_at = new Date();
      if (refund.status === RefundStatus.ACCEPTED) {
        await this.completeRefundSettlement(manager, order, refund);
      } else {
        await manager.save(Refund, refund);
        order.settlement_status = SettlementStatus.HOLDING;
        await manager.save(Order, order);
      }
      return buildResponse(APP_RESPONSE.OK, {
        refund_id: refund.id,
        status: refund.status,
      });
    });
  }

  /** Called by a scheduler/worker. Strict `>` preserves the agreed deadline boundary. */
  async acceptExpiredRefunds(limit = 100) {
    const now = new Date();
    return this.dataSource.transaction(async (manager) => {
      const refunds = await manager
        .getRepository(Refund)
        .createQueryBuilder('refund')
        .where(
          'refund.status = :status AND refund.seller_response_deadline < :now',
          { status: 'requested', now },
        )
        .orderBy('refund.id', 'ASC')
        .take(limit)
        .setLock('pessimistic_write')
        .getMany();
      for (const refund of refunds) {
        refund.status = RefundStatus.ACCEPTED;
        refund.decision_source = RefundDecisionSource.SYSTEM_TIMEOUT;
        refund.responded_by = null;
        refund.responded_at = now;
        const order = await manager
          .getRepository(Order)
          .createQueryBuilder('order')
          .where('order.id = :orderId', { orderId: refund.order_id })
          .setLock('pessimistic_write')
          .getOne();
        if (
          !order ||
          order.settlement_status !== SettlementStatus.REFUND_REQUESTED
        )
          continue;
        await this.completeRefundSettlement(manager, order, refund);
      }
      return refunds.length;
    });
  }

  private async completeRefundSettlement(
    manager: EntityManager,
    order: Order,
    refund: Refund,
  ) {
    // Financial completion and order settlement are atomic. No inventory is
    // restocked because this version has no physical return confirmation.
    await this.walletLedgerService.applyOperation(manager, {
      type: WalletOperationType.ORDER_REFUND,
      referenceType: WalletReferenceType.REFUND,
      referenceId: refund.id,
      idempotencyKey: `REFUND_SETTLEMENT:${refund.id}`,
      description: `Refund settlement for order #${order.id}`,
      entries: [
        {
          userId: order.buyer_id,
          bucket: WalletBalanceBucket.AVAILABLE,
          direction: WalletEntryDirection.CREDIT,
          amount: refund.amount,
        },
        {
          userId: order.seller_id,
          bucket: WalletBalanceBucket.PENDING,
          direction: WalletEntryDirection.DEBIT,
          amount: refund.amount,
        },
      ],
    });
    const settledAt = new Date();
    refund.status = RefundStatus.COMPLETED;
    refund.completed_at = settledAt;
    await manager.save(Refund, refund);
    order.settlement_status = SettlementStatus.REFUNDED;
    order.settled_at = settledAt;
    order.media_retention_until = new Date(
      settledAt.getTime() + 30 * 24 * 60 * 60 * 1000,
    );
    await manager.save(Order, order);
  }

  /** Called by a scheduler/worker after the return window. */
  async releaseDueSellerPoints(limit = 100) {
    const now = new Date();
    return this.dataSource.transaction(async (manager) => {
      const orders = await manager
        .getRepository(Order)
        .createQueryBuilder('order')
        .where(
          'order.status = :status AND order.settlement_status = :settlement AND order.return_deadline < :now',
          {
            status: OrderStatus.DELIVERED,
            settlement: SettlementStatus.HOLDING,
            now,
          },
        )
        .orderBy('order.id', 'ASC')
        .take(limit)
        .setLock('pessimistic_write')
        .getMany();
      for (const order of orders) {
        await this.walletLedgerService.releaseSellerPoints(
          manager,
          order.seller_id,
          order.id,
          this.getOrderAmount(order),
        );
        order.settlement_status = SettlementStatus.RELEASED;
        order.settled_at = now;
        order.media_retention_until = new Date(
          now.getTime() + 30 * 24 * 60 * 60 * 1000,
        );
        await manager.save(Order, order);
      }
      return orders.length;
    });
  }

  private getOrderAmount(order: Pick<Order, 'total_price' | 'shipping_fee'>) {
    return Number(order.total_price || 0) + Number(order.shipping_fee || 0);
  }

  private async addTimeline(
    orderId: string,
    status: OrderStatus,
    note?: string | null,
    manager?: EntityManager,
    previousStatus: OrderStatus | null = null,
    source: OrderStatusChangeSource = OrderStatusChangeSource.SYSTEM,
    changedBy: string | null = null,
  ) {
    const payload = {
      order_id: orderId,
      previous_status: previousStatus,
      new_status: status,
      change_source: source,
      changed_by: changedBy,
      note: note ?? null,
    };

    if (manager) {
      const timeline = manager.create(OrderTimeline, payload);
      await manager.save(OrderTimeline, timeline);
      return;
    }

    const timeline = this.orderTimelineRepository.create(payload);
    await this.orderTimelineRepository.save(timeline);
  }

  async getOrderTimeline(body: GetOrderTimelineDto, userId: string) {
    const purchaseId = body.purchase_id;

    if (!isCanonicalPositiveIntegerString(purchaseId)) {
      throw new BadRequestException(
        errorResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID),
      );
    }

    const order = await this.orderRepository.findOne({
      where: { id: purchaseId },
    });

    if (!order) {
      throw new BadRequestException(
        errorResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID),
      );
    }

    const isRelated = order.buyer_id === userId || order.seller_id === userId;

    if (!isRelated) {
      throw new BadRequestException(
        errorResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID),
      );
    }

    const timelines = await this.orderTimelineRepository.find({
      where: { order_id: purchaseId },
      order: { created_at: 'ASC' },
    });

    return buildResponse(
      APP_RESPONSE.OK,
      timelines.map((item) => ({
        id: item.id,
        purchase_id: item.order_id,
        state: item.new_status,
        note: item.note,
        created_at: item.created_at,
      })),
    );
  }
}

export { OrdersService as OrderService };
