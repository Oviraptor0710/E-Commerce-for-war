import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  DeleteDateColumn,
  Check,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Order } from '../../orders/entities/order.entity';
import { Product } from '../../products/entities/product.entity';
import { Ward } from './ward.entity';
import { SellerApplication } from '../../sellers/entities/seller-application.entity';
import { SellerProfile } from '../../sellers/entities/seller-profile.entity';
@Entity('addresses')
@Index('idx_addresses_user_list', ['user_id', 'deleted_at', 'is_default'])
@Check('chk_addresses_default_boolean', '`is_default` IN (0, 1)')
export class Address {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  user_id: string;

  @Column({ type: 'bigint' })
  ward_id: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  address_name: string | null;

  @Column('text')
  address_detail: string;

  @Column({ default: false })
  is_default: boolean;

  @DeleteDateColumn({ nullable: true })
  deleted_at: Date;

  @ManyToOne(() => User, (user) => user.addresses, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'fk_addresses_user',
  })
  user: User;

  @OneToMany(() => Order, (order) => order.buyer_address)
  orders_as_buyer: Order[];

  @OneToMany(() => Order, (order) => order.seller_address)
  orders_as_seller: Order[];

  @OneToMany(() => Product, (product) => product.ship_from)
  products_shipped_from: Product[];

  @OneToMany(
    () => SellerApplication,
    (application) => application.ship_from_address,
  )
  seller_applications: SellerApplication[];

  @OneToMany(
    () => SellerProfile,
    (profile) => profile.default_ship_from_address,
  )
  seller_profiles: SellerProfile[];

  @ManyToOne(() => Ward, (ward) => ward.addresses)
  @JoinColumn({
    name: 'ward_id',
    foreignKeyConstraintName: 'fk_addresses_ward',
  })
  ward: Ward;

  @Column()
  receiver_name: string;

  @Column({ type: 'varchar', length: 30 })
  phone: string;

  @Column('text')
  full_address: string;
}
