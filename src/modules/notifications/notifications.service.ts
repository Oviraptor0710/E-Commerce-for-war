import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { ConversationsGateway } from '../conversations/conversations.gateway';
import {
  APP_RESPONSE,
  buildResponse,
} from '../../common/constants/response.constants';
import { GetNotiticationDto } from './dto/get-notification.dto';
import { SetReadNotificationDto } from './dto/set-read-notification.dto';
import { Notification } from './entities/notification.entity';
import { NotificationTargetType } from './enums/notification-target-type.enum';
import { NotificationType } from './enums/notification-type.enum';
import { isCanonicalPositiveIntegerString } from '../../common/validation';

const NOTIFICATION_TARGET_BY_TYPE: Record<
  NotificationType,
  NotificationTargetType
> = {
  [NotificationType.PRODUCT_LIKED]: NotificationTargetType.PRODUCT,
  [NotificationType.PRODUCT_COMMENTED]: NotificationTargetType.PRODUCT,
  [NotificationType.REVIEW_RECEIVED]: NotificationTargetType.PRODUCT,
  [NotificationType.NEW_FOLLOWER]: NotificationTargetType.USER_PROFILE,
  [NotificationType.ORDER_CREATED]: NotificationTargetType.ORDER,
  [NotificationType.ORDER_CONFIRMED]: NotificationTargetType.ORDER,
  [NotificationType.ORDER_SHIPPED]: NotificationTargetType.ORDER,
  [NotificationType.ORDER_DELIVERED]: NotificationTargetType.ORDER,
  [NotificationType.ORDER_COMPLETED]: NotificationTargetType.ORDER,
  [NotificationType.ORDER_CANCELLED]: NotificationTargetType.ORDER,
  [NotificationType.REFUND_COMPLETED]: NotificationTargetType.ORDER,
  [NotificationType.REWARD_CREDITED]: NotificationTargetType.REWARD_RESULT,
  [NotificationType.REWARD_NOT_DETECTED]: NotificationTargetType.REWARD_RESULT,
  [NotificationType.REWARD_PROCESSING_FAILED]:
    NotificationTargetType.REWARD_RESULT,
  [NotificationType.POINTS_REFUNDED]: NotificationTargetType.WALLET_TRANSACTION,
  [NotificationType.SALE_POINTS_RELEASED]:
    NotificationTargetType.WALLET_TRANSACTION,
  [NotificationType.NEW_MESSAGE]: NotificationTargetType.CONVERSATION,
  [NotificationType.SYSTEM_ANNOUNCEMENT]: NotificationTargetType.NEWS,
  [NotificationType.ACCOUNT_STATUS_CHANGED]:
    NotificationTargetType.ACCOUNT_STATUS,
  [NotificationType.SECURITY_ALERT]: NotificationTargetType.ACCOUNT_SECURITY,
  [NotificationType.SELLER_APPLICATION_APPROVED]:
    NotificationTargetType.SELLER_APPLICATION,
  [NotificationType.SELLER_APPLICATION_REJECTED]:
    NotificationTargetType.SELLER_APPLICATION,
};

export interface CreateNotificationInput {
  recipientId: string;
  actorId?: string | null;
  type: NotificationType;
  title: string;
  content?: string | null;
  imageUrl?: string | null;
  isNavigable?: boolean;
  targetType?: NotificationTargetType | null;
  targetId?: string | null;
  data?: Record<string, unknown> | null;
  deduplicationKey?: string | null;
}

export interface CreatedNotification {
  notification: Notification;
  created: boolean;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    private readonly conversationsGateway: ConversationsGateway,
  ) {}

  async getNotification(currentUserId: string, body: GetNotiticationDto) {
    const skip = body.index * body.count;
    const [notifications, total] = await this.notificationRepo.findAndCount({
      where: { user_id: currentUserId },
      order: { created_at: 'DESC', id: 'DESC' },
      skip,
      take: body.count,
    });
    const unread = await this.notificationRepo.count({
      where: { user_id: currentUserId, is_read: false },
    });
    return buildResponse(APP_RESPONSE.OK, {
      notifications,
      total,
      last_update: Date.now(),
      badge: unread,
    });
  }

  private validateInput(input: CreateNotificationInput) {
    if (!isCanonicalPositiveIntegerString(input.recipientId)) {
      throw new ConflictException('Invalid notification recipient.');
    }
    if (
      input.actorId !== null &&
      input.actorId !== undefined &&
      !isCanonicalPositiveIntegerString(input.actorId)
    ) {
      throw new ConflictException('Invalid notification actor.');
    }

    const title = input.title?.trim();
    if (!title || title.length > 255) {
      throw new ConflictException('Invalid notification title.');
    }
    if (input.deduplicationKey && input.deduplicationKey.length > 150) {
      throw new ConflictException('Invalid notification deduplication key.');
    }

    const hasTargetType =
      input.targetType !== null && input.targetType !== undefined;
    const hasTargetId = input.targetId !== null && input.targetId !== undefined;
    if (hasTargetType !== hasTargetId) {
      throw new ConflictException(
        'Notification target type and target id must be provided together.',
      );
    }
    if (input.isNavigable && !hasTargetType) {
      throw new ConflictException(
        'A navigable notification requires a target.',
      );
    }
    if (hasTargetType) {
      const expectedTarget = NOTIFICATION_TARGET_BY_TYPE[input.type];
      if (input.targetType !== expectedTarget) {
        throw new ConflictException(
          `Notification ${input.type} must target ${expectedTarget}.`,
        );
      }
      const targetId = input.targetId;
      if (targetId === null || targetId === undefined) {
        throw new ConflictException('Notification target id is required.');
      }
      if (!isCanonicalPositiveIntegerString(targetId)) {
        throw new ConflictException('Invalid notification target id.');
      }
    }
  }

  private parseInsertResult(raw: unknown) {
    if (!raw || typeof raw !== 'object') {
      return { affectedRows: 0, insertId: '' };
    }
    const result = raw as Record<string, unknown>;
    const rawInsertId = result.insertId;
    return {
      affectedRows: Number(result.affectedRows ?? 0),
      insertId:
        typeof rawInsertId === 'string' ||
        typeof rawInsertId === 'number' ||
        typeof rawInsertId === 'bigint'
          ? String(rawInsertId)
          : '',
    };
  }

  private async persistNotification(
    input: CreateNotificationInput,
    repository: Repository<Notification>,
  ): Promise<CreatedNotification> {
    this.validateInput(input);

    if (input.deduplicationKey) {
      const existing = await repository.findOne({
        where: {
          user_id: input.recipientId,
          deduplication_key: input.deduplicationKey,
        },
      });
      if (existing) return { notification: existing, created: false };
    }

    const insertBuilder = repository
      .createQueryBuilder()
      .insert()
      .into(Notification)
      .values({
        user_id: input.recipientId,
        actor_id: input.actorId ?? null,
        deduplication_key: input.deduplicationKey ?? null,
        type: input.type,
        title: input.title.trim(),
        content: input.content ?? null,
        image_url: input.imageUrl ?? null,
        is_navigable: input.isNavigable ?? false,
        target_type: input.targetType ?? null,
        target_id: input.targetId ?? null,
        data:
          input.data === null || input.data === undefined
            ? null
            : () => ':notificationData',
        is_read: false,
        read_at: null,
      });
    if (input.data !== null && input.data !== undefined) {
      insertBuilder.setParameter(
        'notificationData',
        JSON.stringify(input.data),
      );
    }
    const result = await insertBuilder.orIgnore().execute();
    const insertResult = this.parseInsertResult(result.raw as unknown);

    const created = insertResult.affectedRows === 1;
    const notification = await repository.findOne({
      where: input.deduplicationKey
        ? {
            user_id: input.recipientId,
            deduplication_key: input.deduplicationKey,
          }
        : { id: insertResult.insertId },
    });
    if (!notification) {
      throw new ConflictException('Notification could not be created.');
    }

    return { notification, created };
  }

  async createNotification(
    input: CreateNotificationInput,
  ): Promise<Notification> {
    const result = await this.persistNotification(input, this.notificationRepo);
    if (result.created) this.emitNotification(result.notification);
    return result.notification;
  }

  async createNotificationInTransaction(
    input: CreateNotificationInput,
    manager: EntityManager,
  ): Promise<CreatedNotification> {
    return this.persistNotification(input, manager.getRepository(Notification));
  }

  emitNotification(notification: Notification) {
    this.conversationsGateway.notifyUser(
      notification.user_id,
      'new_notification',
      notification,
    );
  }

  async setReadNotification(
    currentUserId: string,
    body: SetReadNotificationDto,
  ) {
    const notification = await this.notificationRepo.findOne({
      where: {
        id: body.notification_id,
        user_id: currentUserId,
      },
    });
    if (!notification) {
      return buildResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID, null);
    }
    if (!notification.is_read) {
      await this.notificationRepo.update(
        { id: notification.id, user_id: currentUserId, is_read: false },
        { is_read: true, read_at: new Date() },
      );
    }
    const badge = await this.notificationRepo.count({
      where: { user_id: currentUserId, is_read: false },
    });
    return buildResponse(APP_RESPONSE.OK, { badge });
  }
}
