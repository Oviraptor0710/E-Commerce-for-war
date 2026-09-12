import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Address } from '../../orders/entities/address.entity';
import { Product } from '../../products/entities/product.entity';
import { Order } from '../../orders/entities/order.entity';
import { SellerProfileStatus } from '../enums/seller-profile-status.enum';
import { SellerApplication } from './seller-application.entity';

@Entity('seller_profiles')
@Index('idx_seller_profiles_status', ['status'])
@Index('uq_seller_profiles_approved_application', ['approved_application_id'], {
  unique: true,
})
@Index('idx_seller_profiles_default_ship_from', [
  'default_ship_from_address_id',
])
@Check(
  'chk_seller_profiles_created_after_approval',
  '`created_at` >= `approved_at`',
)
@Check(
  'chk_seller_profiles_updated_after_create',
  '`updated_at` >= `created_at`',
)
export class SellerProfile {
  @PrimaryColumn({ type: 'bigint' })
  user_id: string;

  @Column({ type: 'bigint' })
  approved_application_id: string;

  @Column({ type: 'varchar', length: 255 })
  shop_name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'bigint' })
  default_ship_from_address_id: string;

  @Column({
    type: 'enum',
    enum: SellerProfileStatus,
    default: SellerProfileStatus.ACTIVE,
  })
  status: SellerProfileStatus;

  @Column({ type: 'datetime', precision: 6 })
  approved_at: Date;

  @Column({ type: 'datetime', precision: 6 })
  created_at: Date;

  @Column({ type: 'datetime', precision: 6 })
  updated_at: Date;

  @OneToOne(() => User, (user) => user.seller_profile, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'fk_seller_profiles_user',
  })
  user: User;

  @ManyToOne(() => SellerApplication, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'approved_application_id',
    foreignKeyConstraintName: 'fk_seller_profiles_approved_application',
  })
  approved_application: SellerApplication;

  @ManyToOne(() => Address, (address) => address.seller_profiles, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'default_ship_from_address_id',
    foreignKeyConstraintName: 'fk_seller_profiles_default_ship_from',
  })
  default_ship_from_address: Address;

  @OneToMany(() => Product, (product) => product.seller_profile)
  products: Product[];

  @OneToMany(() => Order, (order) => order.seller_profile)
  orders: Order[];
}
