import { ApiProperty } from '@nestjs/swagger';
import { NotificationTargetType } from '../enums/notification-target-type.enum';
import { NotificationType } from '../enums/notification-type.enum';

export class NotificationResponseDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  user_id!: string;

  @ApiProperty({ type: String, nullable: true })
  actor_id!: string | null;

  @ApiProperty({ type: String, nullable: true })
  deduplication_key!: string | null;

  @ApiProperty({ enum: NotificationType })
  type!: NotificationType;

  @ApiProperty({ type: String })
  title!: string;

  @ApiProperty({ type: String, nullable: true })
  content!: string | null;

  @ApiProperty({ type: String, nullable: true })
  image_url!: string | null;

  @ApiProperty({ type: Boolean })
  is_navigable!: boolean;

  @ApiProperty({ enum: NotificationTargetType, nullable: true })
  target_type!: NotificationTargetType | null;

  @ApiProperty({ type: String, nullable: true })
  target_id!: string | null;

  @ApiProperty({ type: Object, nullable: true })
  data!: Record<string, unknown> | null;

  @ApiProperty({ type: Boolean })
  is_read!: boolean;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  read_at!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  created_at!: string;
}

export class NotificationListResponseDataDto {
  @ApiProperty({ type: () => [NotificationResponseDto] })
  notifications!: NotificationResponseDto[];

  @ApiProperty({ type: Number })
  total!: number;

  @ApiProperty({ type: Number })
  last_update!: number;

  @ApiProperty({ type: Number })
  badge!: number;
}

export class NotificationReadResponseDataDto {
  @ApiProperty({ type: Number })
  badge!: number;
}
