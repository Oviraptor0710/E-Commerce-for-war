import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import {
  APP_RESPONSE,
  buildResponse,
} from '../../common/constants/response.constants';
import { ApiResponse } from '../../common/interfaces/api-response.interface';
import { UserBlock } from '../blocks/entities/user-block.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationTargetType } from '../notifications/enums/notification-target-type.enum';
import { NotificationType } from '../notifications/enums/notification-type.enum';
import { Product } from '../products/entities/product.entity';
import { User } from '../users/entities/user.entity';
import { ConversationsGateway } from './conversations.gateway';
import { GetConvDto } from './dto/get-conversation.dto';
import { GetListConvDto } from './dto/get-list-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { SetReadMessageDto } from './dto/set-read-message.dto';
import { ConversationParticipant } from './entities/conversation-participant.entity';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { MessageType } from './enums/message-type.enum';
import { isCanonicalPositiveIntegerString } from '../../common/validation';

interface PreparedMessage {
  content: string;
  type: MessageType;
  preview: string;
}

interface ConversationListRow {
  conversation_id: string;
  last_message_preview: string | null;
  last_message_type: string | null;
  last_message_at: Date | string | null;
  last_message_sender_id: string | null;
  unread_count: number;
  partner_id: string;
  partner_username: string;
  partner_avatar: string | null;
}

interface SendTransactionResult {
  error?: ApiResponse<null>;
  duplicate?: boolean;
  conversationId?: string;
  message?: Message;
  notification?: Awaited<
    ReturnType<NotificationsService['createNotificationInTransaction']>
  >;
}

type ReadTransactionResult =
  | { status: 'invalid_message' }
  | { status: 'not_access' }
  | {
      status: 'updated' | 'unchanged';
      lastReadMessageId: string;
      unreadCount: number;
      readAt: Date | null;
    };

class ConversationIdempotencyConflict extends Error {}

@Injectable()
export class ConversationsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly conversationsGateway: ConversationsGateway,
    private readonly notificationsService: NotificationsService,
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(ConversationParticipant)
    private readonly participantRepo: Repository<ConversationParticipant>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(UserBlock)
    private readonly userBlockRepo: Repository<UserBlock>,
  ) {}

  private fail(code: string, message: string): ApiResponse<null> {
    return buildResponse({ code, message }, null);
  }

  private success(data: unknown): ApiResponse<unknown> {
    return buildResponse(APP_RESPONSE.OK, data);
  }

  private async findConversationIdBetweenUsers(
    firstUserId: string,
    secondUserId: string,
    manager?: EntityManager,
  ): Promise<string | null> {
    const repository = manager
      ? manager.getRepository(ConversationParticipant)
      : this.participantRepo;
    const row = await repository
      .createQueryBuilder('first_participant')
      .innerJoin(
        ConversationParticipant,
        'second_participant',
        'second_participant.conversation_id = first_participant.conversation_id AND second_participant.user_id = :secondUserId',
        { secondUserId },
      )
      .select('first_participant.conversation_id', 'conversation_id')
      .where('first_participant.user_id = :firstUserId', { firstUserId })
      .limit(1)
      .getRawOne<{ conversation_id: string }>();
    return row?.conversation_id ?? null;
  }

  private async isBlocked(
    firstUserId: string,
    secondUserId: string,
    manager?: EntityManager,
  ) {
    const repository = manager
      ? manager.getRepository(UserBlock)
      : this.userBlockRepo;
    return repository.exists({
      where: [
        { blocker_id: firstUserId, blocked_id: secondUserId },
        { blocker_id: secondUserId, blocked_id: firstUserId },
      ],
    });
  }

  private prepareMessage(
    dto: SendMessageDto,
    product?: Product | null,
  ): PreparedMessage | null {
    const rawContent = dto.message?.trim() ?? '';
    if (dto.product_id) {
      if (!product) return null;
      return {
        content: JSON.stringify({
          product_id: dto.product_id,
          message: rawContent,
        }),
        type: MessageType.PRODUCT,
        preview: rawContent
          ? `[Sản phẩm] ${rawContent}`.slice(0, 500)
          : `[Sản phẩm] ${product.title}`.slice(0, 500),
      };
    }

    if (!rawContent || !dto.type_message) return null;
    if (
      dto.type_message === MessageType.SYSTEM ||
      dto.type_message === MessageType.PRODUCT
    ) {
      return null;
    }

    const fixedPreview: Partial<Record<MessageType, string>> = {
      [MessageType.IMAGE]: '[Hình ảnh]',
      [MessageType.VIDEO]: '[Video]',
      [MessageType.FILE]: '[Tệp]',
    };
    return {
      content: rawContent,
      type: dto.type_message,
      preview: (fixedPreview[dto.type_message] ?? rawContent).slice(0, 500),
    };
  }

  private sameMessage(existing: Message, prepared: PreparedMessage) {
    return (
      existing.type === prepared.type && existing.content === prepared.content
    );
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

  private async ensureConversation(
    manager: EntityManager,
    firstUserId: string,
    secondUserId: string,
  ): Promise<string | null> {
    let conversationId = await this.findConversationIdBetweenUsers(
      firstUserId,
      secondUserId,
      manager,
    );
    if (conversationId) return conversationId;

    // Lock the two user rows in a stable order. This serializes only the rare
    // first-message race and prevents two direct conversations for one pair.
    const userIds = [firstUserId, secondUserId].sort(
      (a, b) => a.length - b.length || a.localeCompare(b),
    );
    const users = await manager
      .getRepository(User)
      .createQueryBuilder('user')
      .select(['user.id', 'user.status'])
      .where('user.id IN (:...userIds)', { userIds })
      .orderBy('user.id', 'ASC')
      .setLock('pessimistic_write')
      .getMany();
    if (users.length !== 2 || users.some((user) => user.status !== 'active')) {
      return null;
    }

    conversationId = await this.findConversationIdBetweenUsers(
      firstUserId,
      secondUserId,
      manager,
    );
    if (conversationId) return conversationId;

    const conversation = await manager.getRepository(Conversation).save(
      manager.getRepository(Conversation).create({
        last_message_id: null,
        last_message_preview: null,
        last_message_sender_id: null,
        last_message_type: null,
        last_message_at: null,
      }),
    );
    await manager.getRepository(ConversationParticipant).insert([
      {
        conversation_id: conversation.id,
        user_id: firstUserId,
        last_read_message_id: null,
        last_read_at: null,
        unread_count: 0,
      },
      {
        conversation_id: conversation.id,
        user_id: secondUserId,
        last_read_message_id: null,
        last_read_at: null,
        unread_count: 0,
      },
    ]);
    return conversation.id;
  }

  async sendMessage(currentUserId: string, dto: SendMessageDto) {
    if (
      !isCanonicalPositiveIntegerString(currentUserId) ||
      currentUserId === dto.to_id
    ) {
      return this.fail(
        APP_RESPONSE.PARAMETER_VALUE_INVALID.code,
        APP_RESPONSE.PARAMETER_VALUE_INVALID.message,
      );
    }

    const users = await this.userRepo.find({
      where: { id: In([currentUserId, dto.to_id]), status: 'active' },
      select: { id: true, username: true, avatar: true },
    });
    if (users.length !== 2) {
      return this.fail(
        APP_RESPONSE.USER_NOT_EXIST.code,
        APP_RESPONSE.USER_NOT_EXIST.message,
      );
    }
    if (await this.isBlocked(currentUserId, dto.to_id)) {
      return this.fail(
        APP_RESPONSE.NOT_ACCESS.code,
        APP_RESPONSE.NOT_ACCESS.message,
      );
    }

    const product = dto.product_id
      ? await this.productRepo.findOne({
          where: { id: dto.product_id },
          select: { id: true, title: true },
        })
      : null;
    const prepared = this.prepareMessage(dto, product);
    if (!prepared) {
      return this.fail(
        APP_RESPONSE.PARAMETER_VALUE_INVALID.code,
        APP_RESPONSE.PARAMETER_VALUE_INVALID.message,
      );
    }
    const sender = users.find((user) => user.id === currentUserId)!;

    let transactionResult: SendTransactionResult;
    try {
      transactionResult = await this.dataSource.transaction(
        'READ COMMITTED',
        async (manager): Promise<SendTransactionResult> => {
          if (await this.isBlocked(currentUserId, dto.to_id, manager)) {
            return {
              error: this.fail(
                APP_RESPONSE.NOT_ACCESS.code,
                APP_RESPONSE.NOT_ACCESS.message,
              ),
            };
          }

          const messageRepository = manager.getRepository(Message);
          const existingBeforeConversation = await messageRepository.findOne({
            where: {
              sender_id: currentUserId,
              client_message_id: dto.client_message_id,
            },
          });
          if (existingBeforeConversation) {
            const recipientBelongs = await manager
              .getRepository(ConversationParticipant)
              .exists({
                where: {
                  conversation_id: existingBeforeConversation.conversation_id,
                  user_id: dto.to_id,
                },
              });
            if (
              !recipientBelongs ||
              !this.sameMessage(existingBeforeConversation, prepared)
            ) {
              return {
                error: this.fail(
                  APP_RESPONSE.PARAMETER_VALUE_INVALID.code,
                  APP_RESPONSE.PARAMETER_VALUE_INVALID.message,
                ),
              };
            }
            return {
              duplicate: true,
              conversationId: existingBeforeConversation.conversation_id,
              message: existingBeforeConversation,
            };
          }

          const conversationId = await this.ensureConversation(
            manager,
            currentUserId,
            dto.to_id,
          );
          if (!conversationId) {
            return {
              error: this.fail(
                APP_RESPONSE.USER_NOT_EXIST.code,
                APP_RESPONSE.USER_NOT_EXIST.message,
              ),
            };
          }

          const conversation = await manager
            .getRepository(Conversation)
            .createQueryBuilder('conversation')
            .where('conversation.id = :conversationId', { conversationId })
            .setLock('pessimistic_write')
            .getOne();
          if (!conversation) {
            return {
              error: this.fail(
                APP_RESPONSE.PARAMETER_VALUE_INVALID.code,
                APP_RESPONSE.PARAMETER_VALUE_INVALID.message,
              ),
            };
          }
          const existing = await messageRepository.findOne({
            where: {
              sender_id: currentUserId,
              client_message_id: dto.client_message_id,
            },
          });
          if (existing) {
            if (
              existing.conversation_id !== conversationId ||
              !this.sameMessage(existing, prepared)
            ) {
              throw new ConversationIdempotencyConflict();
            }
            return {
              duplicate: true,
              conversationId,
              message: existing,
            };
          }

          const createdAt = new Date();
          const insert = await messageRepository
            .createQueryBuilder()
            .insert()
            .into(Message)
            .values({
              conversation_id: conversationId,
              sender_id: currentUserId,
              client_message_id: dto.client_message_id,
              content: prepared.content,
              type: prepared.type,
              created_at: createdAt,
            })
            .orIgnore()
            .execute();
          const insertResult = this.parseInsertResult(insert.raw as unknown);

          let message: Message | null = null;
          if (insertResult.affectedRows === 1) {
            message = await messageRepository.findOne({
              where: { id: insertResult.insertId },
            });
          } else {
            message = await messageRepository.findOne({
              where: {
                sender_id: currentUserId,
                client_message_id: dto.client_message_id,
              },
            });
            if (
              !message ||
              message.conversation_id !== conversationId ||
              !this.sameMessage(message, prepared)
            ) {
              throw new ConversationIdempotencyConflict();
            }
            return { duplicate: true, conversationId, message };
          }
          if (!message)
            throw new Error('Message insert succeeded but could not be read.');

          await manager.getRepository(Conversation).update(conversationId, {
            last_message_id: message.id,
            last_message_preview: prepared.preview,
            last_message_sender_id: currentUserId,
            last_message_type: prepared.type,
            last_message_at: message.created_at,
          });
          const unreadUpdate = await manager
            .getRepository(ConversationParticipant)
            .createQueryBuilder()
            .update()
            .set({ unread_count: () => '`unread_count` + 1' })
            .where('conversation_id = :conversationId', { conversationId })
            .andWhere('user_id = :receiverId', { receiverId: dto.to_id })
            .execute();
          if (unreadUpdate.affected !== 1) {
            throw new Error('Conversation recipient is missing.');
          }

          const notification =
            await this.notificationsService.createNotificationInTransaction(
              {
                recipientId: dto.to_id,
                actorId: currentUserId,
                type: NotificationType.NEW_MESSAGE,
                title: `Tin nhắn mới từ ${sender.username}`,
                content: prepared.preview,
                imageUrl: sender.avatar ?? null,
                isNavigable: true,
                targetType: NotificationTargetType.CONVERSATION,
                targetId: conversationId,
                data: { message_id: message.id },
                deduplicationKey: `NEW_MESSAGE:${message.id}`,
              },
              manager,
            );

          return { conversationId, message, notification };
        },
      );
    } catch (error) {
      if (error instanceof ConversationIdempotencyConflict) {
        return this.fail(
          APP_RESPONSE.PARAMETER_VALUE_INVALID.code,
          APP_RESPONSE.PARAMETER_VALUE_INVALID.message,
        );
      }
      throw error;
    }

    if (transactionResult.error) return transactionResult.error;
    const conversationId = transactionResult.conversationId!;
    const message = transactionResult.message!;
    const messagePayload = {
      id: message.id,
      conversation_id: conversationId,
      sender_id: currentUserId,
      content: message.content,
      type: message.type,
      created_at: message.created_at,
      sender: {
        id: sender.id,
        username: sender.username,
        avatar: sender.avatar,
      },
    };

    if (!transactionResult.duplicate) {
      this.conversationsGateway.notifyUser(
        dto.to_id,
        'new_message',
        messagePayload,
      );
      if (transactionResult.notification?.created) {
        this.notificationsService.dispatchNotification(
          transactionResult.notification.notification,
        );
      }
    }

    return this.success({
      conversation_id: conversationId,
      message_id: message.id,
      created_at: message.created_at,
      duplicated: Boolean(transactionResult.duplicate),
    });
  }

  async getListConversation(currentUserId: string, dto: GetListConvDto) {
    const skip = dto.index * dto.count;
    const rows = await this.participantRepo
      .createQueryBuilder('self_participant')
      .innerJoin(
        Conversation,
        'conversation',
        'conversation.id = self_participant.conversation_id',
      )
      .innerJoin(
        ConversationParticipant,
        'partner_participant',
        'partner_participant.conversation_id = self_participant.conversation_id AND partner_participant.user_id <> self_participant.user_id',
      )
      .innerJoin(User, 'partner', 'partner.id = partner_participant.user_id')
      .select('conversation.id', 'conversation_id')
      .addSelect('conversation.last_message_preview', 'last_message_preview')
      .addSelect('conversation.last_message_type', 'last_message_type')
      .addSelect('conversation.last_message_at', 'last_message_at')
      .addSelect(
        'conversation.last_message_sender_id',
        'last_message_sender_id',
      )
      .addSelect('self_participant.unread_count', 'unread_count')
      .addSelect('partner.id', 'partner_id')
      .addSelect('partner.username', 'partner_username')
      .addSelect('partner.avatar', 'partner_avatar')
      .where('self_participant.user_id = :currentUserId', { currentUserId })
      .orderBy('conversation.last_message_at', 'DESC')
      .addOrderBy('conversation.id', 'DESC')
      .offset(skip)
      .limit(dto.count)
      .getRawMany<ConversationListRow>();

    const summary = await this.participantRepo
      .createQueryBuilder('participant')
      .select('COUNT(*)', 'total')
      .addSelect('COALESCE(SUM(participant.unread_count), 0)', 'unread')
      .where('participant.user_id = :currentUserId', { currentUserId })
      .getRawOne<{ total: string; unread: string }>();

    const conversations = rows.map((row) => {
      const unreadCount = row.unread_count;
      return {
        id: row.conversation_id,
        partner: {
          id: row.partner_id,
          username: row.partner_username,
          avatar: row.partner_avatar,
        },
        last_message: row.last_message_at
          ? {
              message: row.last_message_preview,
              type: row.last_message_type,
              created: row.last_message_at,
              sender_id: row.last_message_sender_id,
              unread: unreadCount > 0,
            }
          : null,
        num_new_message: unreadCount,
      };
    });

    return this.success({
      conversations,
      total: Number(summary?.total ?? 0),
      num_new_message: Number(summary?.unread ?? 0),
    });
  }

  private async resolveConversation(
    currentUserId: string,
    conversationId?: string,
    partnerId?: string,
  ): Promise<
    | { conversationId: string; partnerId: string }
    | { conversationId: null; partnerId: string }
    | null
  > {
    if (Boolean(conversationId) === Boolean(partnerId)) return null;

    if (partnerId) {
      if (partnerId === currentUserId) return null;
      const partner = await this.userRepo.findOne({
        where: { id: partnerId, status: 'active' },
        select: { id: true },
      });
      if (!partner) return null;
      return {
        conversationId: await this.findConversationIdBetweenUsers(
          currentUserId,
          partnerId,
        ),
        partnerId,
      };
    }

    if (!conversationId || !/^[1-9]\d*$/.test(conversationId)) return null;
    const id = conversationId;
    const membership = await this.participantRepo.findOne({
      where: { conversation_id: id, user_id: currentUserId },
    });
    if (!membership) return null;
    const partner = await this.participantRepo
      .createQueryBuilder('participant')
      .select('participant.user_id', 'user_id')
      .where('participant.conversation_id = :id', { id })
      .andWhere('participant.user_id <> :currentUserId', { currentUserId })
      .getRawOne<{ user_id: string }>();
    if (!partner) return null;
    return { conversationId: id, partnerId: partner.user_id };
  }

  async getConversation(currentUserId: string, dto: GetConvDto) {
    const resolved = await this.resolveConversation(
      currentUserId,
      dto.conversation_id,
      dto.partner_id,
    );
    if (!resolved) {
      return this.fail(
        APP_RESPONSE.PARAMETER_VALUE_INVALID.code,
        APP_RESPONSE.PARAMETER_VALUE_INVALID.message,
      );
    }

    const canSendMessage = !(await this.isBlocked(
      currentUserId,
      resolved.partnerId,
    ));
    if (!resolved.conversationId) {
      return this.success({
        conversation_id: null,
        messages: [],
        can_send_message: canSendMessage,
      });
    }

    const participant = await this.participantRepo.findOne({
      where: {
        conversation_id: resolved.conversationId,
        user_id: currentUserId,
      },
    });
    if (!participant) {
      return this.fail(
        APP_RESPONSE.NOT_ACCESS.code,
        APP_RESPONSE.NOT_ACCESS.message,
      );
    }

    const [messages, total] = await this.messageRepo.findAndCount({
      where: { conversation_id: resolved.conversationId },
      relations: ['sender'],
      order: { created_at: 'DESC', id: 'DESC' },
      skip: dto.index * dto.count,
      take: dto.count,
    });
    const lastReadId = participant.last_read_message_id
      ? BigInt(participant.last_read_message_id)
      : 0n;

    return this.success({
      conversation_id: resolved.conversationId,
      messages: messages.map((message) => ({
        id: message.id,
        message: message.content,
        unread:
          message.sender_id !== currentUserId &&
          BigInt(message.id) > lastReadId,
        type: message.type,
        created: message.created_at,
        sender: {
          id: message.sender.id,
          username: message.sender.username,
          avatar: message.sender.avatar,
        },
      })),
      can_send_message: canSendMessage,
      total,
    });
  }

  async setReadMessage(currentUserId: string, dto: SetReadMessageDto) {
    if (!/^[1-9]\d*$/.test(dto.last_read_message_id)) {
      return this.fail(
        APP_RESPONSE.PARAMETER_VALUE_INVALID.code,
        APP_RESPONSE.PARAMETER_VALUE_INVALID.message,
      );
    }

    const resolved = await this.resolveConversation(
      currentUserId,
      dto.conversation_id,
      dto.partner_id,
    );
    if (!resolved) {
      return this.fail(
        APP_RESPONSE.PARAMETER_VALUE_INVALID.code,
        APP_RESPONSE.PARAMETER_VALUE_INVALID.message,
      );
    }
    if (!resolved.conversationId) {
      return this.fail(
        APP_RESPONSE.PARAMETER_VALUE_INVALID.code,
        APP_RESPONSE.PARAMETER_VALUE_INVALID.message,
      );
    }

    const result = await this.dataSource.transaction<ReadTransactionResult>(
      'READ COMMITTED',
      async (manager) => {
        // Keep the same lock order as sendMessage: conversation first, then
        // participant. This serializes an incoming message with a read cursor
        // update without introducing the inverse lock order that causes
        // deadlocks.
        const conversation = await manager
          .getRepository(Conversation)
          .createQueryBuilder('conversation')
          .where('conversation.id = :conversationId', {
            conversationId: resolved.conversationId,
          })
          .setLock('pessimistic_write')
          .getOne();
        if (!conversation) return { status: 'not_access' };

        const participant = await manager
          .getRepository(ConversationParticipant)
          .createQueryBuilder('participant')
          .where('participant.conversation_id = :conversationId', {
            conversationId: resolved.conversationId,
          })
          .andWhere('participant.user_id = :currentUserId', { currentUserId })
          .setLock('pessimistic_write')
          .getOne();
        if (!participant) return { status: 'not_access' };

        const acknowledgedMessage = await manager
          .getRepository(Message)
          .findOne({
            where: {
              id: dto.last_read_message_id,
              conversation_id: resolved.conversationId,
            },
            select: { id: true },
          });
        if (!acknowledgedMessage) return { status: 'invalid_message' };

        if (
          participant.last_read_message_id &&
          BigInt(dto.last_read_message_id) <=
            BigInt(participant.last_read_message_id)
        ) {
          return {
            status: 'unchanged',
            lastReadMessageId: participant.last_read_message_id,
            unreadCount: participant.unread_count,
            readAt: participant.last_read_at,
          };
        }

        const unreadCount = await manager
          .getRepository(Message)
          .createQueryBuilder('message')
          .where('message.conversation_id = :conversationId', {
            conversationId: resolved.conversationId,
          })
          .andWhere('message.sender_id <> :currentUserId', { currentUserId })
          .andWhere('message.id > :lastReadMessageId', {
            lastReadMessageId: dto.last_read_message_id,
          })
          .getCount();
        const readAt = new Date();
        await manager.getRepository(ConversationParticipant).update(
          {
            conversation_id: resolved.conversationId,
            user_id: currentUserId,
          },
          {
            last_read_message_id: dto.last_read_message_id,
            last_read_at: readAt,
            unread_count: unreadCount,
          },
        );
        return {
          status: 'updated',
          lastReadMessageId: dto.last_read_message_id,
          unreadCount,
          readAt,
        };
      },
    );
    if (result.status === 'not_access') {
      return this.fail(
        APP_RESPONSE.NOT_ACCESS.code,
        APP_RESPONSE.NOT_ACCESS.message,
      );
    }
    if (result.status === 'invalid_message') {
      return this.fail(
        APP_RESPONSE.PARAMETER_VALUE_INVALID.code,
        APP_RESPONSE.PARAMETER_VALUE_INVALID.message,
      );
    }

    const payload = {
      conversation_id: resolved.conversationId,
      reader_id: currentUserId,
      last_read_message_id: result.lastReadMessageId,
      unread_count: result.unreadCount,
      read_at: result.readAt,
    };
    if (result.status === 'updated') {
      this.conversationsGateway.notifyUser(
        resolved.partnerId,
        'read_message',
        payload,
      );
      this.conversationsGateway.notifyUser(
        currentUserId,
        'read_message',
        payload,
      );
    }
    return this.success({
      ...payload,
      updated: result.status === 'updated',
    });
  }
}
