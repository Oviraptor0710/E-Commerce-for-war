import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
  Check,
} from 'typeorm';
import { Product } from './product.entity';
import { User } from '../../users/entities/user.entity';
import { CommentMedia } from './comment-media.entity';

@Entity('comments')
@Index('uq_comments_user_idempotency', ['user_id', 'idempotency_key'], {
  unique: true,
})
@Index('idx_comments_product_created', ['product_id', 'created_at', 'id'])
@Check(
  'chk_comments_content_length',
  '`content` IS NULL OR CHAR_LENGTH(`content`) <= 2000',
)
export class Comment {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  product_id: string;

  @Column({ type: 'bigint' })
  user_id: string;

  @Column('text', { nullable: true })
  content: string | null;

  @Column({ type: 'varchar', length: 150 })
  idempotency_key: string;

  @Column({ type: 'varchar', length: 64 })
  request_hash: string;

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  created_at: Date;

  @ManyToOne(() => Product, (product) => product.comments)
  @JoinColumn({
    name: 'product_id',
    foreignKeyConstraintName: 'fk_comments_product',
  })
  product: Product;

  @ManyToOne(() => User, (user) => user.comments)
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_4c675567d2a58f0b07cef09c13d',
  })
  user: User;

  @OneToMany(() => CommentMedia, (media) => media.comment)
  media: CommentMedia[];
}
