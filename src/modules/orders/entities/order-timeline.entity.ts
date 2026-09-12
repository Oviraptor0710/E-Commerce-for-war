import {
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
import { OrderStatus } from '../enums/order-status.enum';
import { OrderStatusChangeSource } from '../enums/order-status-change-source.enum';

@Entity('order_timelines')
@Index('idx_order_timelines_history', ['order_id', 'created_at', 'id'])
export class OrderTimeline {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id: string;
  @Column({ type: 'bigint' }) order_id: string;
  @Column({ type: 'enum', enum: OrderStatus, nullable: true })
  previous_status: OrderStatus | null;
  @Column({ type: 'enum', enum: OrderStatus }) new_status: OrderStatus;
  @Column({
    type: 'enum',
    enum: OrderStatusChangeSource,
    default: OrderStatusChangeSource.SYSTEM,
  })
  change_source: OrderStatusChangeSource;
  @Column({ type: 'bigint', nullable: true }) changed_by: string | null;
  @Column({ type: 'text', nullable: true }) note: string | null;
  @CreateDateColumn({ type: 'datetime', precision: 6 }) created_at: Date;
  @ManyToOne(() => Order, (order) => order.timelines, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'order_id',
    foreignKeyConstraintName: 'fk_order_timelines_order',
  })
  order: Order;
  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'changed_by',
    foreignKeyConstraintName: 'fk_order_timelines_changed_by',
  })
  changer: User;
}
