import { ApiProperty } from '@nestjs/swagger';

export class FileUploadResponseDataDto {
  @ApiProperty({ type: String, format: 'uri' }) url!: string;
}

export class CommentMediaUploadResponseDataDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) media_type!: string;
  @ApiProperty({ type: String }) mime_type!: string;
  @ApiProperty({ type: String, description: 'Kích thước file theo byte, biểu diễn dạng chuỗi vì BIGINT.' }) size_bytes!: string;
  @ApiProperty({ type: Number, nullable: true }) duration_ms!: number | null;
  @ApiProperty({ type: String, format: 'uri' }) url!: string;
  @ApiProperty({ type: String, format: 'date-time' }) expires_at!: string;
}
