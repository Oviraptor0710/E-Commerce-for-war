import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { DevToken } from '../dev_tokens/entities/dev-token.entity';
import { getApps } from 'firebase-admin/app';
import { getMessaging, MulticastMessage } from 'firebase-admin/messaging';
import { ProductVariant } from './entities/product_variant.entity';
import { CreateProductDto } from './dto/create_product.dto';
import { User } from '../users/entities/user.entity';
import { Like } from './entities/like.entity';
import { Report } from './entities/report.entity';
import { APP_RESPONSE, buildResponse } from '../constants/response.constants';
import { UpdateProductDto } from './dto/update_product.dto';
import { GetUserListingsDto } from './dto/get_user_listing.dto';
import { Brand } from './entities/brand.entity';
import { Category } from './entities/category.entity';
import { Address } from '../orders/entities/address.entity';
import { UserBlock } from '../blocks/entities/user-block.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { ProductsSearchService } from './products-search.service';
import { SellerProfile } from '../sellers/entities/seller-profile.entity';
import { SellerProfileStatus } from '../sellers/enums/seller-profile-status.enum';
import { InventoryMovement } from '../inventory/entities/inventory-movement.entity';
import { InventoryMovementType } from '../inventory/enums/inventory-movement-type.enum';
import { NotificationType } from '../notifications/enums/notification-type.enum';
import { NotificationTargetType } from '../notifications/enums/notification-target-type.enum';
import { isCanonicalPositiveIntegerString } from '../../common/validation';
import { ProductCommentsService } from './product-comments.service';

@Injectable()
export class ProductsService implements OnModuleInit {
  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Like)
    private readonly likeRepo: Repository<Like>,

    @InjectRepository(Address)
    private readonly addressRepo: Repository<Address>,

    @InjectRepository(SellerProfile)
    private readonly sellerProfileRepo: Repository<SellerProfile>,

    @InjectRepository(Brand)
    private readonly brandRepo: Repository<Brand>,

    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,

    @InjectRepository(Report)
    private readonly reportRepo: Repository<Report>,

    @InjectRepository(ProductVariant)
    private variantRepo: Repository<ProductVariant>,

    @InjectRepository(UserBlock)
    private readonly userBlockRepo: Repository<UserBlock>,

    @InjectRepository(DevToken)
    private readonly devTokenRepo: Repository<DevToken>,

    private readonly notificationsService: NotificationsService,
    private readonly productsSearchService: ProductsSearchService,
    private readonly productCommentsService: ProductCommentsService,
  ) {}

  private async sendPushNotification(
    userId: string,
    title?: string,
    body?: string,
    data?: any,
  ) {
    try {
      if (!getApps().length) return;

      const tokens = await this.devTokenRepo.find({
        where: { user_id: userId, is_active: true },
      });

      if (tokens.length === 0) return;

      const deviceTokens = tokens.map((t) => t.devtoken);

      const message: MulticastMessage = {
        tokens: deviceTokens,
        data: data
          ? Object.fromEntries(
              Object.entries(data).map(([k, v]) => [k, String(v)]),
            )
          : {},
      };

      if (title || body) {
        message.notification = {
          title: title || '',
          body: body || '',
        };
      }

      const response = await getMessaging().sendEachForMulticast(message);
      console.log(
        `FCM notification sent to user ${userId}, success: ${response.successCount}, failure: ${response.failureCount}`,
      );
    } catch (error) {
      console.error(
        `Failed to send FCM notification to user ${userId}:`,
        error,
      );
    }
  }

  async onModuleInit() {
    try {
      await this.productsSearchService.createIndex();
      console.log('Elasticsearch index initialized successfully');
    } catch (err) {
      console.error('Failed to initialize Elasticsearch index:', err);
    }
  }

  async isUserBlockedWithSeller(currentUserId?: string, sellerId?: string) {
    if (!currentUserId || !sellerId) return false;
    if (currentUserId === sellerId) return false;

    const block = await this.userBlockRepo.findOne({
      where: [
        { blocker_id: currentUserId, blocked_id: sellerId },
        { blocker_id: sellerId, blocked_id: currentUserId },
      ],
    });

    return !!block;
  }

  private async hasActiveSellerProfile(userId: string) {
    return this.sellerProfileRepo.exists({
      where: {
        user_id: userId,
        status: SellerProfileStatus.ACTIVE,
      },
    });
  }

  private effectiveVariantPrice(variant: {
    price: number;
    discount_price?: number | null;
  }) {
    const price = Number(variant.price);
    const discount =
      variant.discount_price === null || variant.discount_price === undefined
        ? null
        : Number(variant.discount_price);
    return discount === null ? price : discount;
  }

  private getPriceRange(variants: ProductVariant[]) {
    const prices = variants
      .filter((variant) => !variant.deleted_at)
      .map((variant) => this.effectiveVariantPrice(variant));

    if (
      prices.length === 0 ||
      prices.some((price) => !Number.isFinite(price))
    ) {
      throw new Error('A product must have at least one valid active variant');
    }

    return {
      min_price: Math.min(...prices),
      max_price: Math.max(...prices),
    };
  }

  private validateVariantInput(variant: any) {
    const price = Number(variant.price);
    const discount =
      variant.discount_price === null || variant.discount_price === undefined
        ? null
        : Number(variant.discount_price);

    return (
      Number.isInteger(variant.stock) &&
      variant.stock >= 0 &&
      Number.isFinite(price) &&
      price >= 0 &&
      (discount === null ||
        (Number.isFinite(discount) && discount >= 0 && discount <= price)) &&
      (variant.size === undefined || typeof variant.size === 'string') &&
      (variant.color === undefined || typeof variant.color === 'string') &&
      (variant.weight === undefined ||
        (typeof variant.weight === 'number' && variant.weight >= 0))
    );
  }

  async createProduct(dto: CreateProductDto, user_id: string) {
    try {
      if (!user_id) {
        return APP_RESPONSE.TOKEN_INVALID;
      }

      const sellerProfile = await this.sellerProfileRepo.findOne({
        where: {
          user_id,
          status: SellerProfileStatus.ACTIVE,
        },
      });

      if (!sellerProfile) return APP_RESPONSE.NOT_ACCESS;

      if (dto.image_urls !== undefined) {
        if (!Array.isArray(dto.image_urls)) {
          return APP_RESPONSE.PARAMETER_TYPE_INVALID;
        }
        if (dto.image_urls.length > 4) {
          return APP_RESPONSE.MAXIMUM_NUMBER_OF_IMAGES;
        }
      }
      const finalImage = [...(dto.image_urls || [])];
      const hasDuplicateImages = new Set(finalImage).size !== finalImage.length;

      if (hasDuplicateImages) {
        return APP_RESPONSE.PARAMETER_VALUE_INVALID;
      }

      if (dto.variants.length === 0) {
        return APP_RESPONSE.PARAMETER_NOT_ENOUGH;
      }
      if (dto.videos !== undefined) {
        if (!Array.isArray(dto.videos)) {
          return APP_RESPONSE.PARAMETER_TYPE_INVALID;
        }
        const invalidVideo = dto.videos.some((v) => {
          return !v.url;
        });
        if (invalidVideo) return APP_RESPONSE.PARAMETER_NOT_ENOUGH;
      }

      const isInvalidVariant = dto.variants.some((v) => {
        return !this.validateVariantInput(v);
      });

      if (isInvalidVariant) {
        return APP_RESPONSE.PARAMETER_TYPE_INVALID;
      }

      const category = await this.categoryRepo.findOne({
        where: { id: dto.category_id },
      });
      if (!category) {
        return APP_RESPONSE.PARAMETER_VALUE_INVALID;
      }

      if (dto.brand_id !== undefined) {
        const brand = await this.brandRepo.findOne({
          where: { id: dto.brand_id },
        });
        if (!brand) {
          return APP_RESPONSE.PARAMETER_VALUE_INVALID;
        }
      }

      const shipFrom = await this.addressRepo.findOne({
        where: { id: dto.ship_from_id, user_id },
      });
      if (!shipFrom) {
        return APP_RESPONSE.PARAMETER_VALUE_INVALID;
      }

      const priceRange = this.getPriceRange(
        dto.variants.map((variant) => ({
          ...variant,
          deleted_at: null,
        })) as unknown as ProductVariant[],
      );

      const product = await this.dataSource.transaction(async (manager) => {
        const productRepository = manager.getRepository(Product);
        const variantRepository = manager.getRepository(ProductVariant);
        const { variants, ...productData } = dto;

        const savedProduct = await productRepository.save(
          productRepository.create({
            ...productData,
            seller_id: user_id,
            min_price: priceRange.min_price,
            max_price: priceRange.max_price,
          }),
        );

        const variantEntities = variants.map((variant) =>
          variantRepository.create({
            ...variant,
            id: undefined,
            product_id: savedProduct.id,
          }),
        );
        const savedVariants = await variantRepository.save(variantEntities);
        const initialMovements = savedVariants
          .filter((variant) => variant.stock > 0)
          .map((variant) =>
            manager.create(InventoryMovement, {
              variant_id: variant.id,
              type: InventoryMovementType.INITIAL_STOCK,
              quantity_delta: variant.stock,
              stock_before: 0,
              stock_after: variant.stock,
              idempotency_key: `PRODUCT_VARIANT_INITIAL:${savedProduct.id}:${variant.id}`,
              created_by: user_id,
              reason: 'Initial stock when seller created the variant',
            }),
          );
        if (initialMovements.length > 0) {
          await manager.save(InventoryMovement, initialMovements);
        }
        return savedProduct;
      });

      // Index to Elasticsearch
      this.productsSearchService.indexProduct(product).catch((err) => {
        console.error('Failed to index new product to Elasticsearch:', err);
      });

      const { title, ...restProduct } = product;
      return buildResponse(APP_RESPONSE.OK, { ...restProduct, name: title });
    } catch (e) {
      console.error('CREATE PRODUCT ERROR:', e);
      console.log(e);
      return APP_RESPONSE.EXCEPTION_ERROR;
    }
  }
  async findAll(): Promise<Product[]> {
    return await this.productRepo.find();
  }

  //update product
  async update(
    user_id: string,
    id: string,
    dto: UpdateProductDto,
  ): Promise<any> {
    try {
      if (!user_id) {
        return APP_RESPONSE.TOKEN_INVALID;
      }

      if (!isCanonicalPositiveIntegerString(id)) {
        return APP_RESPONSE.PARAMETER_VALUE_INVALID;
      }

      const product = await this.productRepo.findOne({
        where: { id },
        relations: ['variants'],
      });

      if (!product) {
        return APP_RESPONSE.PRODUCT_NOT_EXISTED;
      }

      if (product.seller_id !== user_id) {
        return APP_RESPONSE.NOT_ACCESS;
      }
      if (!(await this.hasActiveSellerProfile(user_id))) {
        return APP_RESPONSE.NOT_ACCESS;
      }
      if (dto.title !== undefined && typeof dto.title !== 'string') {
        return APP_RESPONSE.PARAMETER_TYPE_INVALID;
      }

      if (
        dto.category_id !== undefined &&
        !isCanonicalPositiveIntegerString(dto.category_id)
      ) {
        return APP_RESPONSE.PARAMETER_TYPE_INVALID;
      }

      if (
        dto.ship_from_id !== undefined &&
        !isCanonicalPositiveIntegerString(dto.ship_from_id)
      ) {
        return APP_RESPONSE.PARAMETER_TYPE_INVALID;
      }

      if (dto.videos !== undefined) {
        if (!Array.isArray(dto.videos)) {
          return APP_RESPONSE.PARAMETER_TYPE_INVALID;
        }
        const invalidVideo = dto.videos.some((v) => {
          return !v.url;
        });
        if (invalidVideo) return APP_RESPONSE.PARAMETER_NOT_ENOUGH;
      }
      if (dto.variants !== undefined) {
        if (!Array.isArray(dto.variants) || dto.variants.length === 0) {
          return APP_RESPONSE.PARAMETER_NOT_ENOUGH;
        }

        const isInvalidVariant = dto.variants.some((v) => {
          return (
            (v.id !== undefined && !isCanonicalPositiveIntegerString(v.id)) ||
            !this.validateVariantInput(v)
          );
        });

        if (isInvalidVariant) {
          return APP_RESPONSE.PARAMETER_TYPE_INVALID;
        }
      }

      if (dto.brand_id !== undefined) {
        const brand = await this.brandRepo.findOne({
          where: { id: dto.brand_id },
        });
        if (!brand) {
          return APP_RESPONSE.PARAMETER_VALUE_INVALID;
        }
      }
      if (dto.category_id !== undefined) {
        const category = await this.categoryRepo.findOne({
          where: { id: dto.category_id },
        });
        if (!category) return APP_RESPONSE.PARAMETER_VALUE_INVALID;
      }

      if (dto.ship_from_id !== undefined) {
        const address = await this.addressRepo.findOne({
          where: { id: dto.ship_from_id, user_id },
        });
        if (!address) return APP_RESPONSE.PARAMETER_VALUE_INVALID;
      }

      let finalImages = [...(product.image_urls || [])];

      const imageUrlsDel = dto.image_urls_del;
      if (imageUrlsDel !== undefined) {
        if (
          !Array.isArray(dto.image_urls_del) ||
          dto.image_urls_del.some((i) => typeof i !== 'string')
        ) {
          return APP_RESPONSE.PARAMETER_TYPE_INVALID;
        }
        const invalidDelete = dto.image_urls_del.some(
          (img) => !finalImages.includes(img),
        );
        if (invalidDelete) return APP_RESPONSE.PARAMETER_VALUE_INVALID;
        finalImages = finalImages.filter((url) => !imageUrlsDel.includes(url));
      }
      if (dto.image_urls !== undefined) {
        if (
          !Array.isArray(dto.image_urls) ||
          dto.image_urls.some((i) => typeof i !== 'string')
        ) {
          return APP_RESPONSE.PARAMETER_TYPE_INVALID;
        }
        finalImages = finalImages = [...finalImages, ...dto.image_urls];
      }
      const hasDuplicateImages =
        new Set(finalImages).size !== finalImages.length;

      if (hasDuplicateImages) {
        return APP_RESPONSE.PARAMETER_VALUE_INVALID;
      }
      if (finalImages.length > 4) {
        return APP_RESPONSE.MAXIMUM_NUMBER_OF_IMAGES;
      }

      const finalVideos =
        dto.videos !== undefined ? dto.videos : product.videos || [];

      const hasVideos = finalVideos.length > 0;
      if (finalImages.length > 0 && hasVideos) {
        return APP_RESPONSE.PARAMETER_VALUE_INVALID;
      }

      const {
        variants,
        image_urls,
        image_urls_del,
        idempotency_key,
        ...productUpdateData
      } = dto;

      const updatePayload: any = { ...productUpdateData };

      if (dto.image_urls !== undefined || dto.image_urls_del !== undefined) {
        updatePayload.image_urls = finalImages;
      }

      await this.dataSource.transaction(async (manager) => {
        const productRepository = manager.getRepository(Product);
        const variantRepository = manager.getRepository(ProductVariant);
        const lockedProduct = await productRepository
          .createQueryBuilder('product')
          .setLock('pessimistic_write')
          .where('product.id = :id', { id })
          .getOne();

        if (!lockedProduct || lockedProduct.seller_id !== user_id) {
          throw new Error('PRODUCT_NOT_ACCESS');
        }

        if (Object.keys(updatePayload).length > 0) {
          await productRepository.update(id, updatePayload);
        }

        for (const v of variants || []) {
          if (v.id !== undefined) {
            const variant = await variantRepository
              .createQueryBuilder('variant')
              .setLock('pessimistic_write')
              .where('variant.id = :variantId', { variantId: v.id })
              .andWhere('variant.product_id = :productId', { productId: id })
              .andWhere('variant.deleted_at IS NULL')
              .getOne();
            if (!variant) throw new Error('VARIANT_NOT_FOUND');

            const previousStock = variant.stock || 0;
            const nextStock = v.stock;

            await variantRepository.update(variant.id, {
              size: v.size,
              stock: v.stock,
              color: v.color,
              weight: v.weight,
              price: v.price,
              discount_price: v.discount_price ?? null,
            });

            if (previousStock !== nextStock) {
              await manager.save(
                InventoryMovement,
                manager.create(InventoryMovement, {
                  variant_id: variant.id,
                  type: InventoryMovementType.SELLER_ADJUSTMENT,
                  quantity_delta: nextStock - previousStock,
                  stock_before: previousStock,
                  stock_after: nextStock,
                  idempotency_key: idempotency_key
                    ? `${idempotency_key}:variant:${variant.id}`
                    : `SELLER_STOCK_ADJUSTMENT:${user_id}:${variant.id}:${previousStock}:${nextStock}`,
                  created_by: user_id,
                  reason: 'Seller adjusted variant stock',
                }),
              );
            }
          } else {
            const savedVariant = await variantRepository.save(
              variantRepository.create({
                ...v,
                product_id: id,
              }),
            );
            if (savedVariant.stock > 0) {
              await manager.save(
                InventoryMovement,
                manager.create(InventoryMovement, {
                  variant_id: savedVariant.id,
                  type: InventoryMovementType.INITIAL_STOCK,
                  quantity_delta: savedVariant.stock,
                  stock_before: 0,
                  stock_after: savedVariant.stock,
                  idempotency_key: `PRODUCT_VARIANT_INITIAL:${id}:${savedVariant.id}`,
                  created_by: user_id,
                  reason: 'Initial stock when seller added the variant',
                }),
              );
            }
          }
        }

        const activeVariants = await variantRepository.find({
          where: { product_id: id },
          order: { id: 'ASC' },
        });
        if (activeVariants.length === 0) throw new Error('NO_ACTIVE_VARIANT');

        const priceRange = this.getPriceRange(activeVariants);
        await productRepository.update(id, priceRange);
      });

      const updateProduct = await this.getProductById(id, true);
      if (!updateProduct) {
        return APP_RESPONSE.PRODUCT_NOT_EXISTED;
      }

      // Update index in Elasticsearch
      this.productsSearchService.indexProduct(updateProduct).catch((err) => {
        console.error('Failed to index updated product to Elasticsearch:', err);
      });

      const { title, ...restProduct } = updateProduct;
      return buildResponse(APP_RESPONSE.OK, {
        name: title,
        ...restProduct,
      });
    } catch (e) {
      console.error('UPDATE PRODUCT ERROR:', e);
      if (e instanceof Error && e.message === 'PRODUCT_NOT_ACCESS') {
        return APP_RESPONSE.NOT_ACCESS;
      }
      if (e instanceof Error && e.message === 'VARIANT_NOT_FOUND') {
        return APP_RESPONSE.PARAMETER_VALUE_INVALID;
      }
      return APP_RESPONSE.EXCEPTION_ERROR;
    }
  }

  //delete product
  async remove(id: string, user_id: string) {
    if (!user_id) {
      return APP_RESPONSE.TOKEN_INVALID;
    }
    if (!isCanonicalPositiveIntegerString(id)) {
      return APP_RESPONSE.PARAMETER_NOT_ENOUGH;
    }
    const product = await this.productRepo.findOne({
      where: { id },
      relations: ['variants'],
    });
    if (!product) {
      return APP_RESPONSE.PRODUCT_NOT_EXISTED;
    }
    if (product.seller_id !== user_id) {
      return APP_RESPONSE.NOT_ACCESS;
    }
    if (!(await this.hasActiveSellerProfile(user_id))) {
      return APP_RESPONSE.NOT_ACCESS;
    }
    await this.variantRepo.softDelete({ product: { id } });
    await this.productRepo.softDelete(id);

    // Remove from Elasticsearch
    this.productsSearchService.removeProduct(id).catch((err) => {
      console.error(
        'Failed to remove deleted product from Elasticsearch:',
        err,
      );
    });

    return APP_RESPONSE.OK;
  }
  //get_user_listing
  async get_listing(user_id1: string, query: GetUserListingsDto) {
    if (!user_id1) {
      return APP_RESPONSE.TOKEN_INVALID;
    }
    const { index, count, user_id, keyword, category_id } = query;

    const pageIndex = index;
    const pageCount = count;

    if (
      !Number.isInteger(pageIndex) ||
      pageIndex < 0 ||
      !Number.isInteger(pageCount) ||
      pageCount <= 0
    ) {
      return APP_RESPONSE.PARAMETER_VALUE_INVALID;
    }

    if (user_id !== undefined) {
      if (!isCanonicalPositiveIntegerString(user_id)) {
        return APP_RESPONSE.PARAMETER_TYPE_INVALID;
      }
    }
    const target_user_id = user_id ?? user_id1;
    if (user_id) {
      const user = await this.userRepo.findOne({
        where: { id: user_id },
      });
      if (!user) {
        return APP_RESPONSE.PARAMETER_VALUE_INVALID;
      }
    }

    const queryBuilder = this.productRepo
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.likes', 'likes')
      .leftJoinAndSelect('product.comments', 'comments')
      .leftJoinAndSelect('product.variants', 'variants')
      .leftJoinAndSelect('product.order_items', 'order_items')
      .where('product.seller_id = :sellerId', { sellerId: target_user_id });

    if (keyword !== undefined) {
      if (typeof keyword !== 'string')
        return APP_RESPONSE.PARAMETER_TYPE_INVALID;
      queryBuilder.andWhere('LOWER(product.title) LIKE LOWER(:keyword)', {
        keyword: `%${keyword}%`,
      });
    }
    if (category_id !== undefined) {
      if (!isCanonicalPositiveIntegerString(category_id))
        return APP_RESPONSE.PARAMETER_TYPE_INVALID;
      queryBuilder.andWhere('product.category_id = :catId', {
        catId: category_id,
      });
    }
    queryBuilder.skip(pageIndex * pageCount).take(pageCount);

    const products = await queryBuilder.getMany();

    const data = products.map((p) => {
      const is_liked = (p.likes || []).some((l) => l.user_id === user_id1);

      const is_stock = (p.variants || []).some((v) => v.stock > 0);
      const variants_data = (p.variants || []).map((v) => ({
        id: v.id,
        size: v.size,
        color: v.color,
        price: String(v.price ?? 0),
        price_new:
          v.discount_price !== undefined && v.discount_price !== null
            ? String(v.discount_price)
            : String(v.price ?? 0),
        stock: v.stock ?? 0,
      }));
      return {
        id: p.id,
        name: p.title || '',
        price: String(p.min_price ?? 0),
        price_min: String(p.min_price ?? 0),
        price_max: String(p.max_price ?? 0),
        image: p.image_urls && p.image_urls.length > 0 ? p.image_urls[0] : null,
        video: p.videos && p.videos.length > 0 ? p.videos[0] : null,
        like: p.likes?.length ?? 0,
        comment: p.comments?.length ?? 0,
        variants: variants_data,
        is_stock,
        is_liked,
      };
    });
    return buildResponse(APP_RESPONSE.OK, data);
  }

  async getCategories(parentId?: string, index?: number, count?: number) {
    const qb = this.categoryRepo.createQueryBuilder('category');

    if (parentId === '0') {
      qb.where('category.parent_id IS NULL');
    } else if (parentId !== undefined) {
      qb.where('category.parent_id = :parentId', { parentId });
    }

    qb.orderBy('category.sort', 'ASC').addOrderBy('category.id', 'ASC');

    if (index !== undefined && count !== undefined) {
      qb.skip(index).take(count);
    }

    return await qb.getMany();
  }

  async getListBrands(
    categoryId?: string,
    index: number = 0,
    count: number = 10,
  ) {
    const qb = this.brandRepo
      .createQueryBuilder('brand')
      .select(['brand.id', 'brand.name', 'brand.category_id']);

    if (categoryId !== undefined && categoryId !== null && categoryId !== '0') {
      qb.where('brand.category_id = :categoryId', { categoryId });
    }

    qb.orderBy('brand.id', 'ASC').skip(index).take(count);

    const rows = await qb.getMany();

    return rows.map((item) => ({
      id: item.id,
      brand_name: item.name,
    }));
  }

  //getProductById(1, true): co variants, getProductById(1): khong co
  async getProductById(id: string, withVariants = false) {
    return this.productRepo.findOne({
      where: { id },
      relations: withVariants ? ['variants'] : [],
    });
  }

  async getListProducts(query: any, authUserId?: string) {
    const {
      category_id,
      keyword,
      brand_id,
      product_size_id,
      price_min,
      price_max,
      condition,
      order,
      latitude,
      longitude,
      last_id,
      index = 0,
      count = 10,
    } = query;

    const qb = this.productRepo
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.variants', 'variant')
      .leftJoinAndSelect('product.likes', 'likes')
      .leftJoinAndSelect('product.comments', 'comments')
      .leftJoinAndSelect('product.brand', 'brand')
      .leftJoinAndSelect('product.category', 'category');

    if (category_id !== undefined) {
      qb.andWhere('product.category_id = :category_id', { category_id });
    }

    if (keyword !== undefined && keyword !== '') {
      qb.andWhere(
        '(product.title LIKE :keyword OR product.description LIKE :keyword)',
        { keyword: `%${keyword}%` },
      );
    }

    if (brand_id !== undefined) {
      qb.andWhere('product.brand_id = :brand_id', { brand_id });
    }

    if (product_size_id !== undefined && product_size_id !== 0) {
      qb.andWhere('variant.id = :product_size_id', { product_size_id });
    }

    if (price_min !== undefined) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM product_variants price_variant_min WHERE price_variant_min.product_id = product.id AND price_variant_min.deleted_at IS NULL AND COALESCE(price_variant_min.discount_price, price_variant_min.price) >= :price_min)',
        { price_min },
      );
    }

    if (price_max !== undefined) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM product_variants price_variant_max WHERE price_variant_max.product_id = product.id AND price_variant_max.deleted_at IS NULL AND COALESCE(price_variant_max.discount_price, price_variant_max.price) <= :price_max)',
        { price_max },
      );
    }

    if (condition !== undefined && condition !== '') {
      qb.andWhere('product.condition = :condition', { condition });
    }

    if (last_id !== undefined) {
      qb.andWhere('product.id < :last_id', { last_id });
    }

    switch (order) {
      case 'price_asc':
        qb.orderBy('product.min_price', 'ASC');
        break;
      case 'price_desc':
        qb.orderBy('product.max_price', 'DESC');
        break;
      case 'created_desc':
        qb.orderBy('product.created_at', 'DESC');
        break;
      case 'like_desc':
        qb.loadRelationCountAndMap('product.like_count', 'product.likes');
        qb.orderBy('product.like_count', 'DESC');
        break;
      case 'comment_desc':
        qb.loadRelationCountAndMap('product.comment_count', 'product.comments');
        qb.orderBy('product.comment_count', 'DESC');
        break;
      case 'discount_percent_desc':
        qb.addSelect(
          '(CASE WHEN product.max_price > 0 AND product.min_price < product.max_price THEN ((product.max_price - product.min_price) / product.max_price) ELSE 0 END)',
          'discount_percent_value',
        );
        qb.orderBy('discount_percent_value', 'DESC');
        break;
      case 'discount_value_desc':
        qb.addSelect(
          '(product.max_price - product.min_price)',
          'discount_value',
        );
        qb.orderBy('discount_value', 'DESC');
        break;
      case 'distance_asc':
        // Chưa có cột lat/lng của product/shop để tính đúng khoảng cách.
        // Tạm fallback theo newest.
        qb.orderBy('product.id', 'DESC');
        break;
      default:
        qb.orderBy('product.id', 'DESC');
        break;
    }

    qb.skip(index).take(count);

    const products = await qb.getMany();

    return products.map((p) => {
      const likeCount = p.likes ? p.likes.length : 0;
      const commentCount = p.comments ? p.comments.length : 0;
      const variants = p.variants || [];
      const isStock = variants.some((v: ProductVariant) => v.stock > 0);
      const isLiked =
        p.likes?.some((like: Like) => like.user_id === authUserId) ?? false;

      return {
        id: p.id,
        name: p.title || '',
        price: String(p.min_price ?? 0),
        price_min: String(p.min_price ?? 0),
        price_max: String(p.max_price ?? 0),
        image: p.image_urls && p.image_urls.length > 0 ? p.image_urls[0] : null,
        video: p.videos && p.videos.length > 0 ? p.videos[0] : null,
        like: likeCount,
        comment: commentCount,
        is_liked: isLiked,
        is_stock: isStock,
        brand: p.brand
          ? {
              id: p.brand.id,
              brand_name: p.brand.name,
            }
          : null,
        category: p.category
          ? {
              id: p.category.id,
              name: p.category.name,
            }
          : null,
        variants: variants.map((v: any) => ({
          id: v.id,
          size: v.size,
          color: v.color,
          price: String(v.price ?? 0),
          price_new:
            v.discount_price !== undefined && v.discount_price !== null
              ? String(v.discount_price)
              : String(v.price ?? 0),
          stock: v.stock ?? 0,
        })),
      };
    });
  }

  async getProductDetail(productId: string, authUserId?: string) {
    const product = await this.productRepo.findOne({
      where: { id: productId },
      relations: [
        'seller_profile',
        'seller_profile.user',
        'variants',
        'likes',
        'comments',
        'category',
        'brand',
        'ship_from',
      ],
    });

    if (!product) {
      return null;
    }

    let isBlocked = false;

    if (authUserId) {
      isBlocked = await this.isUserBlockedWithSeller(
        authUserId,
        product.seller_id,
      );
    }

    if (isBlocked) {
      return APP_RESPONSE.NOT_ACCESS;
    }

    const likeCount = product.likes ? product.likes.length : 0;
    const commentCount = product.comments ? product.comments.length : 0;

    const isLiked =
      product.likes?.some((like: any) => like.user_id === authUserId) ?? false;

    const canEdit = product.seller_id === authUserId;

    return {
      id: product.id,
      name: product.title || '',
      price: String(product.min_price ?? 0),
      price_min: String(product.min_price ?? 0),
      price_max: String(product.max_price ?? 0),
      described: product.description || '',
      created: product.created_at,
      like: likeCount,
      comment: commentCount,
      is_liked: isLiked,
      image: product.image_urls || [],
      video: [],
      size: (product.variants || []).map((v: any) => ({
        id: v.id,
        size: v.size,
        color: v.color,
        stock: v.stock ?? 0,
        price: String(v.price ?? 0),
        price_new:
          v.discount_price !== undefined && v.discount_price !== null
            ? String(v.discount_price)
            : String(v.price ?? 0),
        weight: v.weight ? String(v.weight) : '0',
      })),
      brand: product.brand
        ? {
            id: product.brand.id,
            brand_name: product.brand.name,
          }
        : product.brand_id !== undefined && product.brand_id !== null
          ? {
              id: product.brand_id,
              brand_name: product.brand_id,
            }
          : null,
      seller: product.seller_profile?.user
        ? {
            id: product.seller_profile.user.id,
            username: product.seller_profile.user.username || '',
            avatar: product.seller_profile.user.avatar || '',
            cover_image: product.seller_profile.user.cover_image || '',
            cover_image_web: product.seller_profile.user.cover_image_web,
            fullname: product.seller_profile.user.fullname || '',
            shop_name: product.seller_profile.shop_name,
          }
        : null,
      category: product.category
        ? {
            id: product.category.id,
            name: product.category.name,
            parent_id: product.category.parent_id ?? '0',
          }
        : null,
      ships_from: product.ship_from?.full_address || '',
      can_edit: canEdit,
      best_offers: [],
      messages: [],
    };
  }

  async getCommentsProduct(productId: string, index: number, count: number) {
    return this.productCommentsService.getComments(productId, index, count);
  }

  async getUserById(id: string) {
    const user = await this.userRepo
      .createQueryBuilder('user')
      .select(['user.id'])
      .where('user.id = :id', { id })
      .getRawOne();

    return user;
  }

  async setCommentsProduct(
    productId: string,
    userId: string,
    content: string | null | undefined,
    mediaIds: string[],
    idempotencyKey: string,
  ) {
    return this.productCommentsService.createComment({
      productId,
      userId,
      content,
      mediaIds,
      idempotencyKey,
    });
  }

  async likeProduct(productId: string, userId: string) {
    const product = await this.productRepo.findOne({
      where: { id: productId },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    const existingLike = await this.likeRepo.findOne({
      where: {
        product_id: productId,
        user_id: userId,
      },
    });

    let is_liked = false;

    if (existingLike) {
      await this.likeRepo.remove(existingLike);
      is_liked = false;
    } else {
      const newLike = this.likeRepo.create({
        product_id: productId,
        user_id: userId,
      });

      await this.likeRepo.save(newLike);
      is_liked = true;

      if (product.seller_id !== userId) {
        const notification = await this.notificationsService.createNotification(
          {
            recipientId: product.seller_id,
            actorId: userId,
            type: NotificationType.PRODUCT_LIKED,
            title: `Có người vừa thích sản phẩm "${product.title}" của bạn`,
            imageUrl: product.image_urls?.[0] ?? null,
            isNavigable: true,
            targetType: NotificationTargetType.PRODUCT,
            targetId: product.id.toString(),
            data: { product_id: product.id, like_id: newLike.id },
            deduplicationKey: `PRODUCT_LIKED:${newLike.id}`,
          },
        );

        await this.sendPushNotification(
          product.seller_id,
          'Thông báo mới',
          `Có người vừa thích sản phẩm "${product.title}" của bạn`,
          {
            type: NotificationType.PRODUCT_LIKED,
            target_id: String(product.id),
            notification_id: notification.id,
          },
        );
      }
    }

    const like_count = await this.likeRepo.count({
      where: { product_id: productId },
    });

    return {
      is_liked,
      like_count,
    };
  }

  async reportProduct(
    productId: string,
    userId: string,
    subject: string,
    details: string,
  ) {
    const existedReport = await this.reportRepo.findOne({
      where: {
        product_id: productId,
        user_id: userId,
      },
    });

    if (existedReport) {
      return APP_RESPONSE.ACTION_DONE_PREVIOUSLY;
    }

    const report = this.reportRepo.create({
      product_id: productId,
      user_id: userId,
      reason: details || subject || '',
    });

    await this.reportRepo.save(report);

    return {
      product_id: productId,
      user_id: userId,
      reason: details || subject || '',
    };
  }

  async searchProducts(
    keyword: string | undefined,
    categoryId: string | undefined,
    brandId: string | undefined,
    priceMin: number | undefined,
    priceMax: number | undefined,
    index: number,
    count: number,
  ) {
    if (keyword !== undefined && keyword.trim() !== '') {
      try {
        const matchedIds = await this.productsSearchService.search(
          keyword,
          categoryId,
          brandId,
          priceMin,
          priceMax,
          index,
          count,
        );

        if (matchedIds.length === 0) {
          return [];
        }

        // Fetch matched products from MySQL database
        const products = await this.productRepo
          .createQueryBuilder('product')
          .where('product.id IN (:...matchedIds)', { matchedIds })
          .getMany();

        // Sort products based on the relevance score order returned by Elasticsearch
        return matchedIds
          .map((id) => products.find((p) => p.id === id))
          .filter(Boolean);
      } catch (error) {
        console.error(
          'Elasticsearch search failed, falling back to database query:',
          error,
        );
      }
    }

    // Fallback or no-keyword query using MySQL database directly
    const qb = this.productRepo.createQueryBuilder('product');

    if (keyword !== undefined && keyword.trim() !== '') {
      const normalizedKeyword = keyword.trim().replace(/\s+/g, ' ');
      const compactKeyword = normalizedKeyword
        .replace(/\s+/g, '')
        .toLowerCase();
      const tokens = normalizedKeyword.toLowerCase().split(' ').filter(Boolean);

      qb.andWhere(
        `
        (
          LOWER(product.title) LIKE :rawKeyword
          OR REPLACE(LOWER(product.title), ' ', '') LIKE :compactKeyword
        )
        `,
        {
          rawKeyword: `%${normalizedKeyword.toLowerCase()}%`,
          compactKeyword: `%${compactKeyword}%`,
        },
      );

      tokens.forEach((token, idx) => {
        qb.andWhere(`LOWER(product.title) LIKE :token${idx}`, {
          [`token${idx}`]: `%${token}%`,
        });
      });
    }

    if (categoryId !== undefined) {
      qb.andWhere('product.category_id = :categoryId', { categoryId });
    }

    if (brandId !== undefined) {
      qb.andWhere('product.brand_id = :brandId', { brandId });
    }

    if (priceMin !== undefined) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM product_variants price_variant_min WHERE price_variant_min.product_id = product.id AND price_variant_min.deleted_at IS NULL AND COALESCE(price_variant_min.discount_price, price_variant_min.price) >= :priceMin)',
        { priceMin },
      );
    }

    if (priceMax !== undefined) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM product_variants price_variant_max WHERE price_variant_max.product_id = product.id AND price_variant_max.deleted_at IS NULL AND COALESCE(price_variant_max.discount_price, price_variant_max.price) <= :priceMax)',
        { priceMax },
      );
    }

    const safeIndex = index ?? 0;
    const safeCount = count ?? 10;

    const data = await qb
      .orderBy('product.id', 'DESC')
      .offset(safeIndex)
      .limit(safeCount)
      .getMany();

    return data;
  }
}
