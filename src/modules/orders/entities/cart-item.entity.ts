import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ProductVariant } from '../../products/entities/product_variant.entity';

@Entity('cart_items')
@Index('UQ_cart_items_user_variant', ['user_id', 'variant_id'], {
  unique: true,
})
export class CartItem {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  user_id: string;

  @Column({ type: 'bigint' })
  variant_id: string;

  @Column('int')
  quantity: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => User, (user) => user.cart_items)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => ProductVariant, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'variant_id',
    foreignKeyConstraintName: 'fk_cart_items_variant',
  })
  variant: ProductVariant;
}
