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
import { Order } from './order.entity';
import { User } from '../../users/entities/user.entity';
import { RefundStatus } from '../enums/refund-status.enum';
import { RefundDecisionSource } from '../enums/refund-decision-source.enum';

@Entity('refunds')
@Index('idx_refunds_response_deadline', ['status', 'seller_response_deadline'])
@Index('uq_refunds_order', ['order_id'], { unique: true })
@Check('chk_refunds_amount_positive', '`amount` > 0')
@Check(
  'chk_refunds_response_deadline_after_request',
  '`seller_response_deadline` > `requested_at`',
)
@Check(
  'chk_refunds_completed_has_timestamp',
  "`status` <> 'completed' OR `completed_at` IS NOT NULL",
)
export class Refund {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id: string;
  @Column({ type: 'bigint' }) order_id: string;
  @Column({ type: 'bigint' }) requested_by: string;
  @Column('decimal', { precision: 20, scale: 3 }) amount: string;
  @Column('text', { nullable: true }) reason: string | null;
  @Column({ type: 'enum', enum: RefundStatus, default: RefundStatus.REQUESTED })
  status: RefundStatus;
  @Column({ type: 'enum', enum: RefundDecisionSource, nullable: true })
  decision_source: RefundDecisionSource | null;
  @Column({ type: 'bigint', nullable: true }) responded_by: string | null;
  @Column('text', { nullable: true }) seller_response: string | null;
  @CreateDateColumn({ type: 'datetime', precision: 6 }) requested_at: Date;
  @Column({ type: 'datetime', precision: 6 }) seller_response_deadline: Date;
  @Column({ type: 'datetime', precision: 6, nullable: true })
  responded_at: Date | null;
  @Column({ type: 'datetime', precision: 6, nullable: true })
  completed_at: Date | null;
  @ManyToOne(() => Order, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'order_id',
    foreignKeyConstraintName: 'fk_refunds_order',
  })
  order: Order;
  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'requested_by',
    foreignKeyConstraintName: 'fk_refunds_requested_by',
  })
  requester: User;
  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'responded_by',
    foreignKeyConstraintName: 'fk_refunds_responded_by',
  })
  responder: User;
}
