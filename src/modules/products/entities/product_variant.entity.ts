import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  DeleteDateColumn,
  Index,
  Check,
} from 'typeorm';
import { Product } from './product.entity';

@Entity('product_variants')
@Index('idx_product_variants_product_active', ['product_id', 'deleted_at'])
@Check('chk_product_variants_price_non_negative', '`price` >= 0')
@Check(
  'chk_product_variants_discount_non_negative',
  '`discount_price` IS NULL OR `discount_price` >= 0',
)
@Check(
  'chk_product_variants_discount_not_above_price',
  '`discount_price` IS NULL OR `discount_price` <= `price`',
)
@Check('chk_product_variants_stock_non_negative', '`stock` >= 0')
@Check(
  'chk_product_variants_weight_non_negative',
  '`weight` IS NULL OR `weight` >= 0',
)
export class ProductVariant {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  product_id: string;

  @DeleteDateColumn({ nullable: true })
  deleted_at: Date;

  @Column('varchar', { nullable: true })
  size: string;

  @Column('varchar', { nullable: true })
  color: string;

  @Column('decimal', { precision: 20, scale: 3 })
  price: number;

  @Column('decimal', { precision: 20, scale: 3, nullable: true })
  discount_price: number | null;

  @Column('int', { default: 0 })
  stock: number;

  @Column('float', { nullable: true })
  weight: number;

  @ManyToOne(() => Product, (product) => product.variants)
  @JoinColumn({
    name: 'product_id',
    foreignKeyConstraintName: 'fk_product_variants_product',
  })
  product: Product;
}
