import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  IsPositiveBigIntId,
  IsPositiveBigIntIdArray,
} from '../../../common/validation';
import { HasCommentPayload } from '../validation/has-comment-payload.decorator';

export class SetCommentsProductDto {
  @ApiProperty()
  @IsPositiveBigIntId()
  @HasCommentPayload()
  product_id: string;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 2000,
  })
  @Transform(({ value }) => {
    const candidate = value as unknown;
    return typeof candidate === 'string' ? candidate.trim() || null : candidate;
  })
  @IsOptional()
  @IsString({ message: '1003' })
  @MaxLength(2000, { message: '1004' })
  content?: string | null;

  @ApiPropertyOptional({
    type: [String],
    maxItems: 4,
  })
  @IsOptional()
  @IsArray({ message: '1003' })
  @ArrayMaxSize(4, { message: '1004' })
  @ArrayUnique({ message: '1004' })
  @IsPositiveBigIntIdArray()
  media_ids?: string[];

  @ApiProperty({ type: String })
  @Transform(({ value }) => {
    const candidate = value as unknown;
    return typeof candidate === 'string' ? candidate.trim() : candidate;
  })
  @IsString({ message: '1003' })
  @IsNotEmpty({ message: '1002' })
  @MaxLength(150, { message: '1004' })
  idempotency_key: string;
}
