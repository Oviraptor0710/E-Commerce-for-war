import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Product } from './product.entity';
import { User } from '../../users/entities/user.entity';

@Entity('reports')
export class Report {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  product_id: string;

  @Column({ type: 'bigint' })
  user_id: string;

  @Column('text', { nullable: true })
  reason: string;

  @ManyToOne(() => Product, (product) => product.reports)
  @JoinColumn({
    name: 'product_id',
    foreignKeyConstraintName: 'fk_reports_product',
  })
  product: Product;

  @ManyToOne(() => User, (user) => user.reports)
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_ca7a21eb95ca4625bd5eaef7e0c',
  })
  user: User;
}
