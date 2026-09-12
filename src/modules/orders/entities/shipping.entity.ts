import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { User } from '../../users/entities/user.entity';

@Entity('shipping')
export class Shipping {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  order_id: string;

  @Column({ type: 'bigint', nullable: true })
  shipper_id: string | null;

  @Column({ type: 'varchar', nullable: true })
  status: string | null;

  @Column({ type: 'varchar', nullable: true })
  tracking_code: string | null;

  @OneToOne(() => Order, (order) => order.shipping)
  @JoinColumn({
    name: 'order_id',
    foreignKeyConstraintName: 'fk_shipping_order',
  })
  order: Order;

  @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'shipper_id',
    foreignKeyConstraintName: 'fk_shipping_shipper',
  })
  shipper: User | null;
}
