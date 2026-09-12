import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { OrderItem } from './order_item.entity';
import { Shipping } from './shipping.entity';
import { Address } from './address.entity';
import { OrderStatus } from '../enums/order-status.enum';
import { OrderTimeline } from './order-timeline.entity';
import { SellerProfile } from '../../sellers/entities/seller-profile.entity';
import { SettlementStatus } from '../enums/settlement-status.enum';

@Entity('orders')
@Index(
  'uq_orders_buyer_checkout_idempotency',
  ['buyer_id', 'checkout_idempotency_key'],
  { unique: true },
)
@Index('idx_orders_settlement_release', [
  'settlement_status',
  'return_deadline',
])
@Index('idx_orders_media_cleanup', ['media_purged_at', 'media_retention_until'])
@Index('idx_orders_buyer_status', ['buyer_id', 'status', 'created_at', 'id'])
@Index('idx_orders_seller_status', ['seller_id', 'status', 'created_at', 'id'])
@Index('idx_orders_comment_eligibility', [
  'buyer_id',
  'seller_id',
  'status',
  'id',
])
@Check('chk_orders_buyer_not_seller', '`buyer_id` <> `seller_id`')
@Check('chk_orders_total_price_non_negative', '`total_price` >= 0')
@Check('chk_orders_shipping_fee_non_negative', '`shipping_fee` >= 0')
@Check(
  'chk_orders_return_requires_delivery',
  '`return_deadline` IS NULL OR `delivered_at` IS NOT NULL',
)
@Check(
  'chk_orders_media_retention_requires_settlement',
  '`media_retention_until` IS NULL OR `settled_at` IS NOT NULL',
)
@Check(
  'chk_orders_media_purge_requires_retention',
  '`media_purged_at` IS NULL OR `media_retention_until` IS NOT NULL',
)
export class Order {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id: string;
  @Column({ type: 'bigint' }) buyer_id: string;
  @Column({ type: 'varchar', length: 150 }) checkout_idempotency_key: string;
  @Column({ type: 'varchar', length: 64 }) checkout_request_hash: string;
  @Column({ type: 'bigint' }) buyer_address_id: string;
  @Column({ type: 'varchar', length: 255 }) buyer_receiver_name: string;
  @Column({ type: 'varchar', length: 30 }) buyer_phone: string;
  @Column('text') buyer_full_address: string;
  @Column({ type: 'bigint' }) seller_id: string;
  @Column({ type: 'bigint' }) seller_address_id: string;
  @Column('text') seller_full_address: string;
  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING_CONFIRMATION,
  })
  status: OrderStatus;
  @Column({ type: 'datetime', precision: 6 }) status_changed_at: Date;
  @Column({
    type: 'enum',
    enum: SettlementStatus,
    default: SettlementStatus.HOLDING,
  })
  settlement_status: SettlementStatus;
  @Column('decimal', { precision: 20, scale: 3, default: '0.000' })
  total_price: string;
  @Column('decimal', { precision: 20, scale: 3, default: 0 })
  shipping_fee: string;
  @Column({ type: 'int', nullable: true, default: 0 })
  leatime: number | null;
  @Column({ type: 'text', nullable: true }) note: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) cancel_reason:
    | string
    | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) refund_reason:
    | string
    | null;
  @Column({ type: 'datetime', precision: 6, nullable: true })
  delivered_at: Date | null;
  @Column({ type: 'datetime', precision: 6, nullable: true })
  return_deadline: Date | null;
  @Column({ type: 'datetime', precision: 6, nullable: true })
  settled_at: Date | null;
  @Column({ type: 'datetime', precision: 6, nullable: true })
  media_retention_until: Date | null;
  @Column({ type: 'datetime', precision: 6, nullable: true })
  media_purged_at: Date | null;
  @CreateDateColumn({ type: 'datetime', precision: 6 }) created_at: Date;
  @ManyToOne(() => User, (user) => user.orders_bought)
  @JoinColumn({ name: 'buyer_id' })
  buyer: User;
  @ManyToOne(() => SellerProfile, (profile) => profile.orders, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'seller_id',
    referencedColumnName: 'user_id',
    foreignKeyConstraintName: 'fk_orders_seller_profile',
  })
  seller_profile: SellerProfile;
  @OneToMany(() => OrderItem, (item) => item.order) items: OrderItem[];
  @OneToOne(() => Shipping, (shipping) => shipping.order) shipping: Shipping;
  @ManyToOne(() => Address, (address) => address.orders_as_buyer)
  @JoinColumn({
    name: 'buyer_address_id',
    foreignKeyConstraintName: 'fk_orders_buyer_address',
  })
  buyer_address: Address;
  @ManyToOne(() => Address, (address) => address.orders_as_seller)
  @JoinColumn({
    name: 'seller_address_id',
    foreignKeyConstraintName: 'fk_orders_seller_address',
  })
  seller_address: Address;
  @OneToMany(() => OrderTimeline, (timeline) => timeline.order)
  timelines: OrderTimeline[];
}
