import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Product } from './product.entity';
import { Brand } from './brand.entity';

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column()
  name: string;

  @Column({ type: 'bigint', nullable: true })
  parent_id: string | null;

  @Column({ nullable: true, default: 0 })
  sort: number;

  @Column({ nullable: true, default: false })
  has_child: boolean;

  @Column({ nullable: true, default: false })
  has_brand: boolean;

  @Column({ nullable: true, default: false })
  has_size: boolean;

  @Column({ nullable: true, default: false })
  require_weight: boolean;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  image_url: string;

  @OneToMany(() => Product, (product) => product.category)
  products: Product[];

  @OneToMany(() => Brand, (brand) => brand.category)
  brands: Brand[];

  @ManyToOne(() => Category, (category) => category.children, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'parent_id',
    foreignKeyConstraintName: 'fk_categories_parent',
  })
  parent: Category | null;

  @OneToMany(() => Category, (category) => category.parent)
  children: Category[];
}
