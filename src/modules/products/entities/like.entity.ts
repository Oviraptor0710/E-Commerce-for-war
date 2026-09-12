import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Product } from './product.entity';
import { User } from '../../users/entities/user.entity';

@Entity('likes')
export class Like {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  product_id: string;

  @Column({ type: 'bigint' })
  user_id: string;

  @ManyToOne(() => Product, (product) => product.likes)
  @JoinColumn({
    name: 'product_id',
    foreignKeyConstraintName: 'fk_likes_product',
  })
  product: Product;

  @ManyToOne(() => User, (user) => user.likes)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
