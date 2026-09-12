import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Conversation } from './conversation.entity';
import { MessageType } from '../enums/message-type.enum';

@Entity('messages')
@Index('idx_messages_conversation_time', ['conversation_id', 'created_at'])
@Index('idx_messages_conversation_id', ['conversation_id', 'id'])
@Index('uq_messages_sender_client_id', ['sender_id', 'client_message_id'], {
  unique: true,
})
export class Message {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  conversation_id: string;

  @Column({ type: 'bigint' })
  sender_id: string;

  @Column({ type: 'varchar', length: 100 })
  client_message_id: string;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  @Column({ type: 'varchar', length: 30 })
  type: MessageType;

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  created_at: Date;

  @ManyToOne(() => Conversation, (conversation) => conversation.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'conversation_id',
    foreignKeyConstraintName: 'fk_messages_conversation',
  })
  conversation: Conversation;

  @ManyToOne(() => User, (user) => user.messages_sent, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'sender_id',
    foreignKeyConstraintName: 'fk_messages_sender',
  })
  sender: User;
}
