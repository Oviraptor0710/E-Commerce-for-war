import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { execFile } from 'child_process';
import { randomUUID } from 'crypto';
import { createReadStream } from 'fs';
import { open, unlink } from 'fs/promises';
import { LessThanOrEqual, Repository } from 'typeorm';
import { promisify } from 'util';
import {
  APP_RESPONSE,
  buildResponse,
} from '../../common/constants/response.constants';
import {
  isCanonicalPositiveIntegerString,
  isWithinMysqlSignedBigIntRange,
} from '../../common/validation';
import { r2Client } from '../../config/config';
import { SecretConfig } from '../../config/secret';
import { MediaAsset } from './entities/media-asset.entity';
import { MediaStatus } from './enums/media-status.enum';
import { MediaType } from './enums/media-type.enum';

const execFileAsync = promisify(execFile);
const IMAGE_MAX_BYTES = 3 * 1024 * 1024;
const VIDEO_MAX_BYTES = 100 * 1024 * 1024;
const VIDEO_MAX_DURATION_MS = 60_000;
const TEMPORARY_MEDIA_TTL_MS = 24 * 60 * 60 * 1000;
const CLEANUP_RETRY_DELAY_MS = 5 * 60 * 1000;

interface DetectedMedia {
  mediaType: MediaType;
  mimeType: string;
  extension: string;
}

@Injectable()
export class UploadService implements OnModuleInit, OnModuleDestroy {
  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    @InjectRepository(MediaAsset)
    private readonly mediaAssetRepository: Repository<MediaAsset>,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;

    const configuredInterval = Number.parseInt(
      process.env.COMMENT_MEDIA_CLEANUP_INTERVAL_MS ?? '',
      10,
    );
    const interval =
      Number.isSafeInteger(configuredInterval) && configuredInterval >= 60_000
        ? configuredInterval
        : 15 * 60 * 1000;

    this.cleanupTimer = setInterval(() => {
      void this.cleanupExpiredTemporaryMedia().catch((error) => {
        console.error('Failed to clean expired temporary media:', error);
      });
    }, interval);
    this.cleanupTimer.unref();

    void this.cleanupExpiredTemporaryMedia().catch((error) => {
      console.error('Initial temporary media cleanup failed:', error);
    });
  }

  onModuleDestroy() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }

  async uploadFile(file: Express.Multer.File) {
    if (!file?.buffer) {
      throw new BadRequestException(
        buildResponse(APP_RESPONSE.PARAMETER_NOT_ENOUGH, null),
      );
    }

    const key = `files/${randomUUID()}-${file.originalname.replaceAll(' ', '-')}`;

    await r2Client.send(
      new PutObjectCommand({
        Bucket: SecretConfig.r2.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    return { url: this.getPublicUrl(key) };
  }

  async uploadCommentMedia(file: Express.Multer.File, uploaderId: string) {
    if (
      !isCanonicalPositiveIntegerString(uploaderId) ||
      !isWithinMysqlSignedBigIntRange(uploaderId) ||
      !file?.path ||
      !file.size
    ) {
      await this.removeTemporaryFile(file?.path);
      throw new BadRequestException(
        buildResponse(APP_RESPONSE.PARAMETER_NOT_ENOUGH, null),
      );
    }

    let uploadedKey: string | null = null;
    let persisted = false;

    try {
      const detected = await this.detectMedia(file.path);
      let durationMs: number | null = null;

      if (detected.mediaType === MediaType.IMAGE) {
        if (file.size > IMAGE_MAX_BYTES) {
          throw new BadRequestException(
            buildResponse(APP_RESPONSE.FILE_SIZE_TOO_BIG, null),
          );
        }
      } else {
        if (file.size > VIDEO_MAX_BYTES) {
          throw new BadRequestException(
            buildResponse(APP_RESPONSE.FILE_SIZE_TOO_BIG, null),
          );
        }
        durationMs = await this.readVideoDurationMs(file.path);
        if (durationMs > VIDEO_MAX_DURATION_MS) {
          throw new BadRequestException(
            buildResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID, null),
          );
        }
      }

      uploadedKey = `comment-media/${uploaderId}/${randomUUID()}.${detected.extension}`;
      await r2Client.send(
        new PutObjectCommand({
          Bucket: SecretConfig.r2.bucket,
          Key: uploadedKey,
          Body: createReadStream(file.path),
          ContentLength: file.size,
          ContentType: detected.mimeType,
        }),
      );

      const asset = await this.mediaAssetRepository.save(
        this.mediaAssetRepository.create({
          uploader_id: uploaderId,
          media_type: detected.mediaType,
          storage_key: uploadedKey,
          mime_type: detected.mimeType,
          size_bytes: String(file.size),
          duration_ms: durationMs,
          status: MediaStatus.TEMPORARY,
          expires_at: new Date(Date.now() + TEMPORARY_MEDIA_TTL_MS),
          attached_at: null,
        }),
      );
      persisted = true;

      return {
        id: asset.id,
        media_type: asset.media_type,
        mime_type: asset.mime_type,
        size_bytes: asset.size_bytes,
        duration_ms: asset.duration_ms,
        url: this.getPublicUrl(asset.storage_key),
        expires_at: asset.expires_at,
      };
    } catch (error) {
      if (uploadedKey && !persisted) {
        await this.deleteObjectQuietly(uploadedKey);
      }
      if (error instanceof BadRequestException) throw error;
      console.error('Comment media upload failed:', error);
      throw new InternalServerErrorException(
        buildResponse(APP_RESPONSE.UPLOAD_FILE_FAILED, null),
      );
    } finally {
      await this.removeTemporaryFile(file.path);
    }
  }

  getPublicUrl(storageKey: string): string {
    const endpoint = SecretConfig.r2.pub_endpoint.replace(/\/$/, '');
    const encodedKey = storageKey
      .split('/')
      .map((part) => encodeURIComponent(part))
      .join('/');
    return `${endpoint}/${encodedKey}`;
  }

  async cleanupExpiredTemporaryMedia(limit = 100): Promise<number> {
    const candidates = await this.mediaAssetRepository.find({
      where: {
        status: MediaStatus.TEMPORARY,
        expires_at: LessThanOrEqual(new Date()),
      },
      order: { expires_at: 'ASC', id: 'ASC' },
      take: Math.min(Math.max(limit, 1), 500),
    });

    let deleted = 0;
    for (const asset of candidates) {
      const claim = await this.mediaAssetRepository.update(
        { id: asset.id, status: MediaStatus.TEMPORARY },
        { status: MediaStatus.DELETING },
      );
      if (claim.affected !== 1) continue;

      try {
        await r2Client.send(
          new DeleteObjectCommand({
            Bucket: SecretConfig.r2.bucket,
            Key: asset.storage_key,
          }),
        );
        await this.mediaAssetRepository.delete({
          id: asset.id,
          status: MediaStatus.DELETING,
        });
        deleted += 1;
      } catch (error) {
        await this.mediaAssetRepository.update(
          { id: asset.id, status: MediaStatus.DELETING },
          {
            status: MediaStatus.TEMPORARY,
            expires_at: new Date(Date.now() + CLEANUP_RETRY_DELAY_MS),
          },
        );
        console.error(`Failed to delete temporary media ${asset.id}:`, error);
      }
    }

    return deleted;
  }

  private async detectMedia(filePath: string): Promise<DetectedMedia> {
    const fileHandle = await open(filePath, 'r');
    try {
      const bytes = Buffer.alloc(32);
      const { bytesRead } = await fileHandle.read(bytes, 0, bytes.length, 0);
      const header = bytes.subarray(0, bytesRead);

      if (
        header.length >= 3 &&
        header[0] === 0xff &&
        header[1] === 0xd8 &&
        header[2] === 0xff
      ) {
        return {
          mediaType: MediaType.IMAGE,
          mimeType: 'image/jpeg',
          extension: 'jpg',
        };
      }

      if (
        header.length >= 8 &&
        header
          .subarray(0, 8)
          .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      ) {
        return {
          mediaType: MediaType.IMAGE,
          mimeType: 'image/png',
          extension: 'png',
        };
      }

      if (
        header.length >= 12 &&
        header.subarray(0, 4).toString('ascii') === 'RIFF' &&
        header.subarray(8, 12).toString('ascii') === 'WEBP'
      ) {
        return {
          mediaType: MediaType.IMAGE,
          mimeType: 'image/webp',
          extension: 'webp',
        };
      }

      if (
        header.length >= 12 &&
        header.subarray(4, 8).toString('ascii') === 'ftyp'
      ) {
        const isQuickTime = header.subarray(8, 12).toString('ascii') === 'qt  ';
        return {
          mediaType: MediaType.VIDEO,
          mimeType: isQuickTime ? 'video/quicktime' : 'video/mp4',
          extension: isQuickTime ? 'mov' : 'mp4',
        };
      }

      if (
        header.length >= 4 &&
        header.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
      ) {
        return {
          mediaType: MediaType.VIDEO,
          mimeType: 'video/webm',
          extension: 'webm',
        };
      }

      throw new BadRequestException(
        buildResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID, null),
      );
    } finally {
      await fileHandle.close();
    }
  }

  private async readVideoDurationMs(filePath: string): Promise<number> {
    try {
      const { stdout } = await execFileAsync(
        process.env.FFPROBE_PATH ?? 'ffprobe',
        [
          '-v',
          'error',
          '-show_entries',
          'format=duration',
          '-of',
          'default=noprint_wrappers=1:nokey=1',
          filePath,
        ],
        { encoding: 'utf8', timeout: 15_000 },
      );
      const seconds = Number.parseFloat(stdout.trim());
      if (!Number.isFinite(seconds) || seconds <= 0) throw new Error();
      return Math.ceil(seconds * 1000);
    } catch {
      throw new BadRequestException(
        buildResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID, null),
      );
    }
  }

  private async deleteObjectQuietly(storageKey: string) {
    try {
      await r2Client.send(
        new DeleteObjectCommand({
          Bucket: SecretConfig.r2.bucket,
          Key: storageKey,
        }),
      );
    } catch (error) {
      console.error(`Failed to compensate R2 upload ${storageKey}:`, error);
    }
  }

  private async removeTemporaryFile(filePath?: string) {
    if (!filePath) return;
    try {
      await unlink(filePath);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') {
        console.error(`Failed to remove temporary upload ${filePath}:`, error);
      }
    }
  }
}
