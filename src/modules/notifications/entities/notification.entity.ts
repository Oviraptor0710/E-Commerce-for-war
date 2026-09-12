import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { NotificationType } from '../enums/notification-type.enum';
import { NotificationTargetType } from '../enums/notification-target-type.enum';

@Entity('notifications')
@Index(
  'uq_notifications_user_deduplication',
  ['user_id', 'deduplication_key'],
  { unique: true },
)
@Index('idx_notifications_user_inbox', ['user_id', 'is_read', 'created_at'])
@Index('idx_notifications_target', ['target_type', 'target_id'])
@Check('chk_notifications_navigable_boolean', '`is_navigable` IN (0, 1)')
@Check('chk_notifications_read_boolean', '`is_read` IN (0, 1)')
@Check(
  'chk_notifications_navigation_target',
  '`is_navigable` = 0 OR (`target_type` IS NOT NULL AND `target_id` IS NOT NULL)',
)
@Check(
  'chk_notifications_read_state',
  '(`is_read` = 0 AND `read_at` IS NULL) OR (`is_read` = 1 AND `read_at` IS NOT NULL)',
)
export class Notification {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id: string;
  @Column({ type: 'bigint' }) user_id: string;
  @Column({ type: 'bigint', nullable: true }) actor_id: string | null;
  @Column({ type: 'varchar', length: 150, nullable: true }) deduplication_key:
    | string
    | null;
  @Column({ type: 'enum', enum: NotificationType }) type: NotificationType;
  @Column({ type: 'varchar', length: 255 }) title: string;
  @Column({ type: 'text', nullable: true }) content: string | null;
  @Column({ type: 'varchar', length: 512, nullable: true }) image_url:
    | string
    | null;
  @Column({ type: 'tinyint', default: 0 }) is_navigable: boolean;
  @Column({ type: 'enum', enum: NotificationTargetType, nullable: true })
  target_type: NotificationTargetType | null;
  @Column({ type: 'bigint', nullable: true }) target_id: string | null;
  @Column({ type: 'json', nullable: true }) data: Record<
    string,
    unknown
  > | null;
  @Column({ type: 'tinyint', default: 0 }) is_read: boolean;
  @Column({ type: 'datetime', precision: 6, nullable: true })
  read_at: Date | null;
  @CreateDateColumn({ type: 'datetime', precision: 6 }) created_at: Date;
  @ManyToOne(() => User, (user) => user.notifications, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'fk_notifications_user',
  })
  user: User;
  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'actor_id',
    foreignKeyConstraintName: 'fk_notifications_actor',
  })
  actor: User | null;
}
