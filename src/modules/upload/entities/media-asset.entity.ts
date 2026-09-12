import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { CommentMedia } from '../../products/entities/comment-media.entity';
import { MediaStatus } from '../enums/media-status.enum';
import { MediaType } from '../enums/media-type.enum';

@Entity('media_assets')
@Index('uq_media_assets_storage_key', ['storage_key'], { unique: true })
@Index('idx_media_assets_cleanup', ['status', 'expires_at'])
@Index('idx_media_assets_owner_status', ['uploader_id', 'status', 'id'])
@Check('chk_media_assets_size_positive', '`size_bytes` > 0')
@Check(
  'chk_media_assets_type_limits',
  "(`media_type` = 'image' AND `size_bytes` <= 3145728 AND `duration_ms` IS NULL) OR " +
    "(`media_type` = 'video' AND `size_bytes` <= 104857600 AND `duration_ms` BETWEEN 1 AND 60000)",
)
@Check(
  'chk_media_assets_lifecycle',
  "(`status` = 'temporary' AND `expires_at` IS NOT NULL AND `attached_at` IS NULL) OR " +
    "(`status` = 'attached' AND `expires_at` IS NULL AND `attached_at` IS NOT NULL) OR " +
    "(`status` = 'deleting' AND `expires_at` IS NOT NULL AND `attached_at` IS NULL)",
)
export class MediaAsset {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  uploader_id: string;

  @Column({ type: 'enum', enum: MediaType })
  media_type: MediaType;

  @Column({ type: 'varchar', length: 512 })
  storage_key: string;

  @Column({ type: 'varchar', length: 100 })
  mime_type: string;

  @Column({ type: 'bigint', unsigned: true })
  size_bytes: string;

  @Column({ type: 'int', unsigned: true, nullable: true })
  duration_ms: number | null;

  @Column({
    type: 'enum',
    enum: MediaStatus,
    default: MediaStatus.TEMPORARY,
  })
  status: MediaStatus;

  @Column({ type: 'datetime', precision: 6, nullable: true })
  expires_at: Date | null;

  @Column({ type: 'datetime', precision: 6, nullable: true })
  attached_at: Date | null;

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  created_at: Date;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'uploader_id',
    foreignKeyConstraintName: 'fk_media_assets_uploader',
  })
  uploader: User;

  @OneToMany(() => CommentMedia, (commentMedia) => commentMedia.media_asset)
  comment_links: CommentMedia[];
}
