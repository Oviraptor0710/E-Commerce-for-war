import {
  Controller,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UploadService } from './upload.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import {
  APP_RESPONSE,
  buildResponse,
} from '../../common/constants/response.constants';
import { AuthGuard } from '../../common/auth/guards/auth.guard';
import type { AuthenticatedRequest } from '../../types/auth.type';
import 'multer';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
} from '@nestjs/swagger';
import { ApiDataResponse } from '../../common/swagger/api-data-response.decorator';
import {
  CommentMediaUploadResponseDataDto,
  FileUploadResponseDataDto,
} from './dto/upload-response.dto';

const commentMediaTempDirectory = join(tmpdir(), 'ecommerce-comment-media');
mkdirSync(commentMediaTempDirectory, { recursive: true });

@ApiBearerAuth('JWT-auth')
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('file')
  @UseGuards(AuthGuard)
  @ApiDataResponse({ status: 201, type: FileUploadResponseDataDto })
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload file lên server' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Chọn file để upload',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['file'],
    },
  })
  async upload(
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const data = await this.uploadService.uploadFile(file);
    return buildResponse(APP_RESPONSE.OK, data);
  }

  @Post('comment-media')
  @UseGuards(AuthGuard)
  @ApiDataResponse({ status: 201, type: CommentMediaUploadResponseDataDto })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: commentMediaTempDirectory,
        filename: (_request, _file, callback) => callback(null, randomUUID()),
      }),
      limits: {
        files: 1,
        fileSize: 100 * 1024 * 1024,
      },
    }),
  )
  @ApiOperation({
    summary:
      'Upload trước một ảnh/video tạm để đính kèm vào bình luận sản phẩm',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  async uploadCommentMedia(
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const userId = req.user?.id ?? req.user?.userId ?? '';
    if (!userId) {
      return buildResponse(APP_RESPONSE.TOKEN_INVALID, null);
    }

    const data = await this.uploadService.uploadCommentMedia(file, userId);
    return buildResponse(APP_RESPONSE.OK, data);
  }
}
