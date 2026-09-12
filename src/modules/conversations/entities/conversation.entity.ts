import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ConversationParticipant } from './conversation-participant.entity';
import { Message } from './message.entity';

@Entity('conversations')
@Index('idx_conversations_last_message_at', ['last_message_at'])
@Index('uq_conversations_last_message_id', ['last_message_id'], {
  unique: true,
})
export class Conversation {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint', nullable: true })
  last_message_id: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  last_message_preview: string | null;

  @Column({ type: 'bigint', nullable: true })
  last_message_sender_id: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  last_message_type: string | null;

  @Column({ type: 'datetime', precision: 6, nullable: true })
  last_message_at: Date | null;

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime', precision: 6 })
  updated_at: Date;

  @OneToMany(
    () => ConversationParticipant,
    (participant) => participant.conversation,
  )
  participants: ConversationParticipant[];

  @OneToMany(() => Message, (message) => message.conversation)
  messages: Message[];

  @ManyToOne(() => Message, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'last_message_id',
    foreignKeyConstraintName: 'fk_conversations_last_message',
  })
  last_message: Message | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'last_message_sender_id',
    foreignKeyConstraintName: 'fk_conversations_last_message_sender',
  })
  last_message_sender: User | null;
}
