import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { Product } from '../../products/entities/product.entity';
import { Order } from '../../orders/entities/order.entity';
import { User } from '../../users/entities/user.entity';

@Entity('rates')
export class Rate {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  user_id: string;

  @Column({ type: 'bigint', nullable: true })
  reviewer_id: string | null;

  @Column({ type: 'bigint', nullable: true })
  product_id: string | null;

  @Column({ type: 'bigint', nullable: true })
  purchase_id: string | null;

  @Column()
  level: number;

  @Column('text', { nullable: true })
  content: string;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'fk_rates_user',
  })
  user: User;

  @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'reviewer_id',
    foreignKeyConstraintName: 'fk_rates_reviewer',
  })
  reviewer: User | null;

  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'product_id',
    foreignKeyConstraintName: 'fk_rates_product',
  })
  product: Product;

  @ManyToOne(() => Order, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'purchase_id',
    foreignKeyConstraintName: 'fk_rates_purchase_order',
  })
  purchase: Order;
}
