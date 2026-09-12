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
import { Product } from '../../products/entities/product.entity';
import { ProductVariant } from '../../products/entities/product_variant.entity';

@Entity('order_items')
@Index('uq_order_items_order_variant', ['order_id', 'variant_id'], {
  unique: true,
})
@Check('chk_order_items_list_price_non_negative', '`unit_list_price` >= 0')
@Check('chk_order_items_unit_price_non_negative', '`unit_price` >= 0')
@Check(
  'chk_order_items_unit_price_not_above_list',
  '`unit_price` <= `unit_list_price`',
)
@Check('chk_order_items_quantity_positive', '`quantity` > 0')
@Check(
  'chk_order_items_total_price',
  '`total_price` = `unit_price` * `quantity`',
)
export class OrderItem {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id: string;
  @Column({ type: 'bigint' }) order_id: string;
  @Column({ type: 'bigint' }) product_id: string;
  @Column({ type: 'bigint' }) variant_id: string;
  @Column({ type: 'varchar', length: 255 }) product_title_snapshot: string;
  @Column({ type: 'varchar', length: 512, nullable: true })
  product_image_snapshot_key: string | null;
  @Column({ type: 'json' }) variant_snapshot: Record<string, unknown>;
  @Column('decimal', { precision: 20, scale: 3 }) unit_list_price: string;
  @Column('decimal', { precision: 20, scale: 3 }) unit_price: string;
  @Column('int') quantity: number;
  @Column('decimal', { precision: 20, scale: 3 }) total_price: string;
  @CreateDateColumn({ type: 'datetime', precision: 6 }) created_at: Date;
  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'order_id',
    foreignKeyConstraintName: 'fk_order_items_order',
  })
  order: Order;
  @ManyToOne(() => Product, (product) => product.order_items, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'product_id',
    foreignKeyConstraintName: 'fk_order_items_product',
  })
  product: Product;
  @ManyToOne(() => ProductVariant, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'variant_id',
    foreignKeyConstraintName: 'fk_order_items_variant',
  })
  variant: ProductVariant;
}
