import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  DeleteDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { SellerProfile } from '../../sellers/entities/seller-profile.entity';
import { ProductVariant } from './product_variant.entity';
import { Comment } from './comment.entity';
import { Like } from './like.entity';
import { Report } from './report.entity';
import { OrderItem } from '../../orders/entities/order_item.entity';
import { Address } from '../../orders/entities/address.entity';
import { Category } from './category.entity';
import { Brand } from './brand.entity';
@Entity('products')
@Index('idx_products_category_active', ['category_id', 'deleted_at'])
@Index('idx_products_brand_active', ['brand_id', 'deleted_at'])
@Index('idx_products_min_price', ['min_price'])
@Index('idx_products_max_price', ['max_price'])
export class Product {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  seller_id: string;

  @Column({ type: 'bigint' })
  ship_from_id: string;

  @Column({ type: 'bigint' })
  category_id: string;

  @Column({ type: 'bigint', nullable: true })
  brand_id: string | null;

  @Column()
  title: string;

  @Column('text', { nullable: true })
  description: string;

  @Column('decimal', { precision: 20, scale: 3 })
  min_price: number;

  @Column('decimal', { precision: 20, scale: 3 })
  max_price: number;

  @Column({ type: 'json', nullable: true })
  videos: { url: string; thumb: string }[];

  @CreateDateColumn()
  created_at: Date;

  @DeleteDateColumn({ nullable: true })
  deleted_at: Date;

  @Column('simple-array', { nullable: true })
  image_urls: string[];

  @ManyToOne(() => SellerProfile, (profile) => profile.products, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'seller_id',
    referencedColumnName: 'user_id',
    foreignKeyConstraintName: 'fk_products_seller_profile',
  })
  seller_profile: SellerProfile;

  @OneToMany(() => ProductVariant, (variant) => variant.product)
  variants: ProductVariant[];

  @OneToMany(() => Comment, (comment) => comment.product)
  comments: Comment[];

  @OneToMany(() => Like, (like) => like.product)
  likes: Like[];

  @OneToMany(() => Report, (report) => report.product)
  reports: Report[];

  @OneToMany(() => OrderItem, (orderItem) => orderItem.product)
  order_items: OrderItem[];

  @ManyToOne(() => Address, (address) => address.products_shipped_from)
  @JoinColumn({
    name: 'ship_from_id',
    foreignKeyConstraintName: 'fk_products_ship_from',
  })
  ship_from: Address;

  @ManyToOne(() => Category, (category) => category.products)
  @JoinColumn({
    name: 'category_id',
    foreignKeyConstraintName: 'fk_products_category',
  })
  category: Category;

  @ManyToOne(() => Brand, (brand) => brand.products)
  @JoinColumn({
    name: 'brand_id',
    foreignKeyConstraintName: 'fk_products_brand',
  })
  brand: Brand;
}
