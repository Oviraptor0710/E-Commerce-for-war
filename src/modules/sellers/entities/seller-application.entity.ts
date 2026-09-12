import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Address } from '../../orders/entities/address.entity';
import { SellerApplicationStatus } from '../enums/seller-application-status.enum';

@Entity('seller_applications')
@Index('idx_seller_applications_admin_queue', ['status', 'submitted_at', 'id'])
@Index('idx_seller_applications_user_history', [
  'applicant_id',
  'status',
  'created_at',
  'id',
])
@Index('idx_seller_applications_reviewed_by', ['reviewed_by'])
@Index('idx_seller_applications_ship_from', ['ship_from_address_id'])
@Check(
  'chk_seller_applications_pending_state',
  "`status` <> 'pending' OR (`reviewed_by` IS NULL AND `reviewed_at` IS NULL AND `rejection_reason` IS NULL)",
)
@Check(
  'chk_seller_applications_approved_state',
  "`status` <> 'approved' OR (`reviewed_by` IS NOT NULL AND `reviewed_at` IS NOT NULL AND `rejection_reason` IS NULL)",
)
@Check(
  'chk_seller_applications_rejected_state',
  "`status` <> 'rejected' OR (`reviewed_by` IS NOT NULL AND `reviewed_at` IS NOT NULL AND `rejection_reason` IS NOT NULL)",
)
@Check(
  'chk_seller_applications_reviewed_after_submit',
  '`reviewed_at` IS NULL OR `reviewed_at` >= `submitted_at`',
)
@Check(
  'chk_seller_applications_submitted_after_create',
  '`submitted_at` >= `created_at`',
)
@Check(
  'chk_seller_applications_updated_after_create',
  '`updated_at` >= `created_at`',
)
export class SellerApplication {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  applicant_id: string;

  @Column({ type: 'varchar', length: 255 })
  shop_name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'bigint' })
  ship_from_address_id: string;

  @Column({ type: 'text' })
  ship_from_full_address_snapshot: string;

  @Column({
    type: 'enum',
    enum: SellerApplicationStatus,
    default: SellerApplicationStatus.PENDING,
  })
  status: SellerApplicationStatus;

  @Column({ type: 'bigint', nullable: true })
  reviewed_by: string | null;

  @Column({ type: 'datetime', precision: 6, nullable: true })
  reviewed_at: Date | null;

  @Column({ type: 'text', nullable: true })
  rejection_reason: string | null;

  @Column({ type: 'datetime', precision: 6 })
  submitted_at: Date;

  @Column({ type: 'datetime', precision: 6 })
  created_at: Date;

  @Column({ type: 'datetime', precision: 6 })
  updated_at: Date;

  @ManyToOne(() => User, (user) => user.seller_applications, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'applicant_id',
    foreignKeyConstraintName: 'fk_seller_applications_applicant',
  })
  applicant: User;

  @ManyToOne(() => User, (user) => user.reviewed_seller_applications, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'reviewed_by',
    foreignKeyConstraintName: 'fk_seller_applications_reviewer',
  })
  reviewer: User | null;

  @ManyToOne(() => Address, (address) => address.seller_applications, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'ship_from_address_id',
    foreignKeyConstraintName: 'fk_seller_applications_ship_from',
  })
  ship_from_address: Address;
}
