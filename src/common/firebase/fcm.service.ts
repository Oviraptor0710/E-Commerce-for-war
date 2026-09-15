import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { getApps } from 'firebase-admin/app';
import { getMessaging, MulticastMessage } from 'firebase-admin/messaging';
import { In, Repository } from 'typeorm';
import { DevToken } from '../../modules/dev_tokens/entities/dev-token.entity';
import { Notification } from '../../modules/notifications/entities/notification.entity';
import { NotificationType } from '../../modules/notifications/enums/notification-type.enum';
import { PushSetting } from '../../modules/push_settings/entities/push-setting.entity';

type PushPreference = 'like' | 'comment' | 'transaction' | 'announcement';

const PUSH_PREFERENCE_BY_NOTIFICATION_TYPE: Partial<
  Record<NotificationType, PushPreference>
> = {
  [NotificationType.PRODUCT_LIKED]: 'like',
  [NotificationType.PRODUCT_COMMENTED]: 'comment',
  [NotificationType.REVIEW_RECEIVED]: 'comment',
  [NotificationType.ORDER_CREATED]: 'transaction',
  [NotificationType.ORDER_CONFIRMED]: 'transaction',
  [NotificationType.ORDER_SHIPPED]: 'transaction',
  [NotificationType.ORDER_DELIVERED]: 'transaction',
  [NotificationType.ORDER_COMPLETED]: 'transaction',
  [NotificationType.ORDER_CANCELLED]: 'transaction',
  [NotificationType.REFUND_COMPLETED]: 'transaction',
  [NotificationType.REWARD_CREDITED]: 'transaction',
  [NotificationType.REWARD_NOT_DETECTED]: 'transaction',
  [NotificationType.REWARD_PROCESSING_FAILED]: 'transaction',
  [NotificationType.POINTS_REFUNDED]: 'transaction',
  [NotificationType.SALE_POINTS_RELEASED]: 'transaction',
  [NotificationType.SYSTEM_ANNOUNCEMENT]: 'announcement',
};

const INVALID_REGISTRATION_TOKEN_CODES = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
]);

@Injectable()
export class FcmService {
  private readonly logger = new Logger(FcmService.name);

  constructor(
    @InjectRepository(DevToken)
    private readonly devTokenRepository: Repository<DevToken>,
    @InjectRepository(PushSetting)
    private readonly pushSettingRepository: Repository<PushSetting>,
  ) {}

  async sendNotification(notification: Notification): Promise<void> {
    if (!getApps().length) return;

    try {
      const setting = await this.pushSettingRepository.findOne({
        where: { user_id: notification.user_id },
      });
      if (!this.isEnabled(notification.type, setting)) return;

      const tokens = await this.devTokenRepository.find({
        where: { user_id: notification.user_id, is_active: true },
      });
      if (tokens.length === 0) return;

      const sound = this.soundFor(setting);
      for (let index = 0; index < tokens.length; index += 500) {
        const batch = tokens.slice(index, index + 500);
        const response = await getMessaging().sendEachForMulticast(
          this.messageFor(notification, batch.map((token) => token.devtoken), sound),
        );

        const invalidTokenIds = response.responses.flatMap((result, responseIndex) =>
          result.success ||
          !INVALID_REGISTRATION_TOKEN_CODES.has(result.error?.code ?? '')
            ? []
            : [batch[responseIndex].id],
        );
        if (invalidTokenIds.length > 0) {
          await this.devTokenRepository.update(
            { id: In(invalidTokenIds) },
            { is_active: false },
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to send FCM notification ${notification.id} to user ${notification.user_id}.`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private isEnabled(
    type: NotificationType,
    setting: PushSetting | null,
  ): boolean {
    const preference = PUSH_PREFERENCE_BY_NOTIFICATION_TYPE[type];
    return !preference || setting?.[preference] !== 0;
  }

  private soundFor(setting: PushSetting | null): string | undefined {
    if (setting?.sound_on === 0) return undefined;
    return setting?.sound_default.trim() || 'default';
  }

  private messageFor(
    notification: Notification,
    tokens: string[],
    sound: string | undefined,
  ): MulticastMessage {
    const data: Record<string, string> = {
      notification_id: notification.id,
      type: notification.type,
    };
    if (notification.target_type) data.target_type = notification.target_type;
    if (notification.target_id) data.target_id = notification.target_id;
    if (notification.data) data.payload = JSON.stringify(notification.data);

    return {
      tokens,
      data,
      notification: {
        title: notification.title,
        body: notification.content ?? '',
        imageUrl: notification.image_url ?? undefined,
      },
      android: {
        priority: 'high',
        ...(sound ? { notification: { sound } } : {}),
      },
      apns: {
        headers: { 'apns-priority': '10' },
        ...(sound ? { payload: { aps: { sound } } } : {}),
      },
    };
  }
}
