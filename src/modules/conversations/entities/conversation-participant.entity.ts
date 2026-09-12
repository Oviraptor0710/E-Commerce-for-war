import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Conversation } from './conversation.entity';
import { Message } from './message.entity';

@Entity('conversation_participants')
@Index('idx_conversation_participants_user', ['user_id', 'conversation_id'])
@Check(
  'chk_conversation_participants_unread_non_negative',
  '`unread_count` >= 0',
)
export class ConversationParticipant {
  @PrimaryColumn({ type: 'bigint' })
  conversation_id: string;

  @PrimaryColumn({ type: 'bigint' })
  user_id: string;

  @Column({ type: 'bigint', nullable: true })
  last_read_message_id: string | null;

  @Column({ type: 'datetime', precision: 6, nullable: true })
  last_read_at: Date | null;

  @Column({ type: 'int', default: 0 })
  unread_count: number;

  @ManyToOne(() => Conversation, (conversation) => conversation.participants, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'conversation_id',
    foreignKeyConstraintName: 'fk_conversation_participants_conversation',
  })
  conversation: Conversation;

  @ManyToOne(() => User, (user) => user.conversation_participations, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'fk_conversation_participants_user',
  })
  user: User;

  @ManyToOne(() => Message, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'last_read_message_id',
    foreignKeyConstraintName: 'fk_conversation_participants_last_read_message',
  })
  last_read_message: Message | null;
}
