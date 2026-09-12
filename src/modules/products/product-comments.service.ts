import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { getApps } from 'firebase-admin/app';
import { getMessaging, MulticastMessage } from 'firebase-admin/messaging';
import {
  DataSource,
  EntityManager,
  In,
  QueryFailedError,
  Repository,
} from 'typeorm';
import {
  APP_RESPONSE,
  buildResponse,
} from '../../common/constants/response.constants';
import {
  isCanonicalPositiveIntegerString,
  isWithinMysqlSignedBigIntRange,
} from '../../common/validation';
import { UserBlock } from '../blocks/entities/user-block.entity';
import { DevToken } from '../dev_tokens/entities/dev-token.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationTargetType } from '../notifications/enums/notification-target-type.enum';
import { NotificationType } from '../notifications/enums/notification-type.enum';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order_item.entity';
import { OrderStatus } from '../orders/enums/order-status.enum';
import { MediaAsset } from '../upload/entities/media-asset.entity';
import { MediaStatus } from '../upload/enums/media-status.enum';
import { MediaType } from '../upload/enums/media-type.enum';
import { UploadService } from '../upload/upload.service';
import { User } from '../users/entities/user.entity';
import { CommentMedia } from './entities/comment-media.entity';
import { Comment } from './entities/comment.entity';
import { Product } from './entities/product.entity';

interface CreateCommentInput {
  productId: string;
  userId: string;
  content?: string | null;
  mediaIds: string[];
  idempotencyKey: string;
}

interface CommentTransactionResult {
  commentId: string;
  duplicate: boolean;
  sellerId?: string;
  productTitle?: string;
  productImageUrl?: string | null;
}

interface RawCommentRow {
  id: string;
  product_id: string;
  user_id: string;
  content: string | null;
  created_at: Date;
  username: string;
  avatar: string | null;
  cover_image: string | null;
  cover_image_web: string | null;
}

interface RawCommentMediaRow {
  id: string;
  comment_id: string;
  type: MediaType;
  mime_type: string;
  storage_key: string;
  position: number;
}

@Injectable()
export class ProductCommentsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(CommentMedia)
    private readonly commentMediaRepository: Repository<CommentMedia>,
    @InjectRepository(DevToken)
    private readonly devTokenRepository: Repository<DevToken>,
    private readonly notificationsService: NotificationsService,
    private readonly uploadService: UploadService,
  ) {}

  async getComments(productId: string, index: number, count: number) {
    const comments = await this.commentRepository
      .createQueryBuilder('comment')
      .leftJoin(User, 'user', 'user.id = comment.user_id')
      .select([
        'comment.id AS id',
        'comment.product_id AS product_id',
        'comment.user_id AS user_id',
        'comment.content AS content',
        'comment.created_at AS created_at',
        'user.username AS username',
        'user.avatar AS avatar',
        'user.cover_image AS cover_image',
        'user.cover_image_web AS cover_image_web',
      ])
      .where('comment.product_id = :productId', { productId })
      .orderBy('comment.created_at', 'DESC')
      .addOrderBy('comment.id', 'DESC')
      .offset(index)
      .limit(count)
      .getRawMany<RawCommentRow>();

    return this.attachMediaToComments(comments);
  }

  async createComment(input: CreateCommentInput) {
    const normalizedContent = input.content?.trim() || null;
    const mediaIds = input.mediaIds ?? [];
    const idempotencyKey = input.idempotencyKey.trim();

    this.validateInput({
      ...input,
      content: normalizedContent,
      mediaIds,
      idempotencyKey,
    });

    const requestHash = createHash('sha256')
      .update(
        JSON.stringify({
          product_id: input.productId,
          content: normalizedContent,
          media_ids: mediaIds,
        }),
      )
      .digest('hex');

    let transactionResult: CommentTransactionResult;
    try {
      transactionResult = await this.createCommentInTransaction(
        {
          ...input,
          content: normalizedContent,
          mediaIds,
          idempotencyKey,
        },
        requestHash,
      );
    } catch (error) {
      if (!this.isDuplicateConstraint(error, 'uq_comments_user_idempotency')) {
        throw error;
      }

      const existing = await this.commentRepository.findOne({
        where: {
          user_id: input.userId,
          idempotency_key: idempotencyKey,
        },
      });
      if (!existing || existing.request_hash !== requestHash) {
        throw new ConflictException(
          buildResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID, null),
        );
      }
      transactionResult = { commentId: existing.id, duplicate: true };
    }

    const result = await this.getCommentById(transactionResult.commentId);
    if (!result) throw new Error('Created comment could not be loaded.');

    if (!transactionResult.duplicate && transactionResult.sellerId) {
      await this.notifySeller(
        transactionResult,
        input.userId,
        input.productId,
        normalizedContent,
        result.id,
      );
    }

    return result;
  }

  private async createCommentInTransaction(
    input: CreateCommentInput,
    requestHash: string,
  ): Promise<CommentTransactionResult> {
    return this.dataSource.transaction(async (manager) => {
      const commentRepository = manager.getRepository(Comment);
      const existing = await commentRepository.findOne({
        where: {
          user_id: input.userId,
          idempotency_key: input.idempotencyKey,
        },
      });
      if (existing) {
        if (existing.request_hash !== requestHash) {
          throw new ConflictException(
            buildResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID, null),
          );
        }
        return { commentId: existing.id, duplicate: true };
      }

      const user = await manager.getRepository(User).findOne({
        where: { id: input.userId },
        select: { id: true },
      });
      if (!user) {
        throw new UnauthorizedException(
          buildResponse(APP_RESPONSE.TOKEN_INVALID, null),
        );
      }

      const product = await manager.getRepository(Product).findOne({
        where: { id: input.productId },
      });
      if (!product) {
        throw new BadRequestException(
          buildResponse(APP_RESPONSE.PRODUCT_NOT_EXISTED, null),
        );
      }

      const blocked = await manager.getRepository(UserBlock).exists({
        where: [
          { blocker_id: input.userId, blocked_id: product.seller_id },
          { blocker_id: product.seller_id, blocked_id: input.userId },
        ],
      });
      if (blocked) {
        throw new ForbiddenException(
          buildResponse(APP_RESPONSE.NOT_ACCESS, null),
        );
      }

      const hasDeliveredPurchase = await manager
        .getRepository(Order)
        .createQueryBuilder('order')
        .innerJoin(
          OrderItem,
          'item',
          'item.order_id = order.id AND item.product_id = :productId',
          { productId: input.productId },
        )
        .where('order.buyer_id = :userId', { userId: input.userId })
        .andWhere('order.seller_id = :sellerId', {
          sellerId: product.seller_id,
        })
        .andWhere('order.status = :delivered', {
          delivered: OrderStatus.DELIVERED,
        })
        .limit(1)
        .getExists();
      if (!hasDeliveredPurchase) {
        throw new ForbiddenException(
          buildResponse(APP_RESPONSE.NOT_ACCESS, null),
        );
      }

      const orderedAssets = await this.lockAndValidateMedia(
        manager,
        input.mediaIds,
        input.userId,
      );
      const comment = await commentRepository.save(
        commentRepository.create({
          product_id: input.productId,
          user_id: input.userId,
          content: input.content ?? null,
          idempotency_key: input.idempotencyKey,
          request_hash: requestHash,
        }),
      );

      if (orderedAssets.length > 0) {
        await manager.save(
          CommentMedia,
          orderedAssets.map((asset, index) =>
            manager.create(CommentMedia, {
              comment_id: comment.id,
              media_asset_id: asset.id,
              position: index + 1,
            }),
          ),
        );

        const attachedAt = new Date();
        const update = await manager.getRepository(MediaAsset).update(
          {
            id: In(input.mediaIds),
            status: MediaStatus.TEMPORARY,
          },
          {
            status: MediaStatus.ATTACHED,
            expires_at: null,
            attached_at: attachedAt,
          },
        );
        if (update.affected !== orderedAssets.length) {
          throw new ConflictException(
            buildResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID, null),
          );
        }
      }

      return {
        commentId: comment.id,
        duplicate: false,
        sellerId: product.seller_id,
        productTitle: product.title,
        productImageUrl: product.image_urls?.[0] ?? null,
      };
    });
  }

  private async lockAndValidateMedia(
    manager: EntityManager,
    mediaIds: string[],
    userId: string,
  ): Promise<MediaAsset[]> {
    if (mediaIds.length === 0) return [];

    const assets = await manager
      .getRepository(MediaAsset)
      .createQueryBuilder('asset')
      .where('asset.id IN (:...mediaIds)', { mediaIds })
      .orderBy('asset.id', 'ASC')
      .setLock('pessimistic_write')
      .getMany();
    if (assets.length !== mediaIds.length) {
      throw new BadRequestException(
        buildResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID, null),
      );
    }

    const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
    const orderedAssets = mediaIds.map((mediaId) => assetsById.get(mediaId)!);
    const now = new Date();
    if (
      orderedAssets.some(
        (asset) =>
          asset.uploader_id !== userId ||
          asset.status !== MediaStatus.TEMPORARY ||
          !asset.expires_at ||
          asset.expires_at <= now,
      )
    ) {
      throw new ForbiddenException(
        buildResponse(APP_RESPONSE.NOT_ACCESS, null),
      );
    }

    const mediaTypes = new Set(orderedAssets.map((asset) => asset.media_type));
    if (
      mediaTypes.size > 1 ||
      (mediaTypes.has(MediaType.VIDEO) && orderedAssets.length !== 1) ||
      (mediaTypes.has(MediaType.IMAGE) && orderedAssets.length > 4)
    ) {
      throw new BadRequestException(
        buildResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID, null),
      );
    }

    return orderedAssets;
  }

  private validateInput(input: CreateCommentInput) {
    const isBigIntId = (value: unknown): value is string =>
      isCanonicalPositiveIntegerString(value) &&
      isWithinMysqlSignedBigIntRange(value);

    if (
      !isBigIntId(input.productId) ||
      !isBigIntId(input.userId) ||
      !input.idempotencyKey ||
      input.idempotencyKey.length > 150 ||
      !Array.isArray(input.mediaIds) ||
      (!input.content && input.mediaIds.length === 0) ||
      (input.content?.length ?? 0) > 2000 ||
      input.mediaIds.length > 4 ||
      new Set(input.mediaIds).size !== input.mediaIds.length ||
      input.mediaIds.some((mediaId) => !isBigIntId(mediaId))
    ) {
      throw new BadRequestException(
        buildResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID, null),
      );
    }
  }

  private async getCommentById(commentId: string) {
    const comment = await this.commentRepository
      .createQueryBuilder('comment')
      .leftJoin(User, 'user', 'user.id = comment.user_id')
      .select([
        'comment.id AS id',
        'comment.product_id AS product_id',
        'comment.user_id AS user_id',
        'comment.content AS content',
        'comment.created_at AS created_at',
        'user.username AS username',
        'user.avatar AS avatar',
        'user.cover_image AS cover_image',
        'user.cover_image_web AS cover_image_web',
      ])
      .where('comment.id = :commentId', { commentId })
      .getRawOne<RawCommentRow>();

    if (!comment) return null;
    const [result] = await this.attachMediaToComments([comment]);
    return result;
  }

  private async attachMediaToComments(comments: RawCommentRow[]) {
    if (comments.length === 0) return [];

    const commentIds = comments.map((comment) => comment.id);
    const media = await this.commentMediaRepository
      .createQueryBuilder('commentMedia')
      .innerJoin(MediaAsset, 'asset', 'asset.id = commentMedia.media_asset_id')
      .select([
        'asset.id AS id',
        'commentMedia.comment_id AS comment_id',
        'asset.media_type AS type',
        'asset.mime_type AS mime_type',
        'asset.storage_key AS storage_key',
        'commentMedia.position AS position',
      ])
      .where('commentMedia.comment_id IN (:...commentIds)', { commentIds })
      .orderBy('commentMedia.comment_id', 'ASC')
      .addOrderBy('commentMedia.position', 'ASC')
      .getRawMany<RawCommentMediaRow>();

    const mediaByComment = new Map<string, Array<Record<string, unknown>>>();
    for (const item of media) {
      const items = mediaByComment.get(item.comment_id) ?? [];
      items.push({
        id: item.id,
        type: item.type,
        mime_type: item.mime_type,
        url: this.uploadService.getPublicUrl(item.storage_key),
        position: item.position,
      });
      mediaByComment.set(item.comment_id, items);
    }

    return comments.map((comment) => ({
      ...comment,
      media: mediaByComment.get(comment.id) ?? [],
    }));
  }

  private async notifySeller(
    transactionResult: CommentTransactionResult,
    actorId: string,
    productId: string,
    content: string | null,
    commentId: string,
  ) {
    try {
      const notification = await this.notificationsService.createNotification({
        recipientId: transactionResult.sellerId!,
        actorId,
        type: NotificationType.PRODUCT_COMMENTED,
        title: `Có người vừa bình luận sản phẩm "${transactionResult.productTitle}" của bạn`,
        content,
        imageUrl: transactionResult.productImageUrl ?? null,
        isNavigable: true,
        targetType: NotificationTargetType.PRODUCT,
        targetId: productId,
        data: { product_id: productId, comment_id: commentId },
        deduplicationKey: `PRODUCT_COMMENTED:${commentId}`,
      });

      await this.sendPushNotification(
        transactionResult.sellerId!,
        'Thông báo mới',
        `Có người vừa bình luận sản phẩm "${transactionResult.productTitle}" của bạn`,
        {
          type: NotificationType.PRODUCT_COMMENTED,
          target_id: productId,
          notification_id: notification.id,
        },
      );
    } catch (error) {
      console.error(
        `Failed to create notification for comment ${commentId}:`,
        error,
      );
    }
  }

  private async sendPushNotification(
    userId: string,
    title: string,
    body: string,
    data: Record<string, unknown>,
  ) {
    try {
      if (!getApps().length) return;
      const tokens = await this.devTokenRepository.find({
        where: { user_id: userId, is_active: true },
      });
      if (tokens.length === 0) return;

      const message: MulticastMessage = {
        tokens: tokens.map((token) => token.devtoken),
        data: Object.fromEntries(
          Object.entries(data).map(([key, value]) => [key, String(value)]),
        ),
        notification: { title, body },
      };
      await getMessaging().sendEachForMulticast(message);
    } catch (error) {
      console.error(
        `Failed to send comment notification to user ${userId}:`,
        error,
      );
    }
  }

  private isDuplicateConstraint(error: unknown, constraint: string) {
    if (!(error instanceof QueryFailedError)) return false;
    const driverError = error.driverError as {
      code?: string;
      message?: string;
      sqlMessage?: string;
    };
    const message = driverError.sqlMessage ?? driverError.message ?? '';
    return driverError.code === 'ER_DUP_ENTRY' && message.includes(constraint);
  }
}
