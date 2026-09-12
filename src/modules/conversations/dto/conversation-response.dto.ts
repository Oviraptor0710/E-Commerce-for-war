import { ApiProperty } from '@nestjs/swagger';
import { MessageType } from '../enums/message-type.enum';

export class ConversationUserResponseDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) username!: string;
  @ApiProperty({ type: String, nullable: true }) avatar!: string | null;
}

export class SendMessageResponseDataDto {
  @ApiProperty({ type: String }) conversation_id!: string;
  @ApiProperty({ type: String }) message_id!: string;
  @ApiProperty({ type: String, format: 'date-time' }) created_at!: string;
  @ApiProperty({ type: Boolean }) duplicated!: boolean;
}

export class ConversationLastMessageResponseDto {
  @ApiProperty({ type: String, nullable: true }) message!: string | null;
  @ApiProperty({ enum: MessageType, nullable: true }) type!: MessageType | null;
  @ApiProperty({ type: String, format: 'date-time' }) created!: string;
  @ApiProperty({ type: String, nullable: true }) sender_id!: string | null;
  @ApiProperty({ type: Boolean }) unread!: boolean;
}

export class ConversationListItemResponseDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: () => ConversationUserResponseDto }) partner!: ConversationUserResponseDto;
  @ApiProperty({ type: () => ConversationLastMessageResponseDto, nullable: true })
  last_message!: ConversationLastMessageResponseDto | null;
  @ApiProperty({ type: Number }) num_new_message!: number;
}

export class ConversationListResponseDataDto {
  @ApiProperty({ type: () => [ConversationListItemResponseDto] })
  conversations!: ConversationListItemResponseDto[];
  @ApiProperty({ type: Number }) total!: number;
  @ApiProperty({ type: Number }) num_new_message!: number;
}

export class ConversationMessageResponseDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String, nullable: true }) message!: string | null;
  @ApiProperty({ type: Boolean }) unread!: boolean;
  @ApiProperty({ enum: MessageType }) type!: MessageType;
  @ApiProperty({ type: String, format: 'date-time' }) created!: string;
  @ApiProperty({ type: () => ConversationUserResponseDto }) sender!: ConversationUserResponseDto;
}

export class ConversationDetailResponseDataDto {
  @ApiProperty({ type: String, nullable: true }) conversation_id!: string | null;
  @ApiProperty({ type: () => [ConversationMessageResponseDto] }) messages!: ConversationMessageResponseDto[];
  @ApiProperty({ type: Boolean }) can_send_message!: boolean;
  @ApiProperty({ type: Number, required: false }) total?: number;
}

export class ReadMessageResponseDataDto {
  @ApiProperty({ type: String }) conversation_id!: string;
  @ApiProperty({ type: String }) reader_id!: string;
  @ApiProperty({ type: String }) last_read_message_id!: string;
  @ApiProperty({ type: Number }) unread_count!: number;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) read_at!: string | null;
  @ApiProperty({ type: Boolean }) updated!: boolean;
}
