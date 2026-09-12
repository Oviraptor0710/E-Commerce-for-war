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
import { MediaAsset } from '../../upload/entities/media-asset.entity';
import { Comment } from './comment.entity';

@Entity('comment_media')
@Index('uq_comment_media_asset', ['media_asset_id'], { unique: true })
@Index('uq_comment_media_position', ['comment_id', 'position'], {
  unique: true,
})
@Check('chk_comment_media_position', '`position` BETWEEN 1 AND 4')
export class CommentMedia {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  comment_id: string;

  @Column({ type: 'bigint' })
  media_asset_id: string;

  @Column({ type: 'tinyint', unsigned: true })
  position: number;

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  created_at: Date;

  @ManyToOne(() => Comment, (comment) => comment.media, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'comment_id',
    foreignKeyConstraintName: 'fk_comment_media_comment',
  })
  comment: Comment;

  @ManyToOne(() => MediaAsset, (asset) => asset.comment_links, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'media_asset_id',
    foreignKeyConstraintName: 'fk_comment_media_asset',
  })
  media_asset: MediaAsset;
}
