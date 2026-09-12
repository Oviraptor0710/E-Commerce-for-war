import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, Max, Min, IsInt } from 'class-validator';
import {
  IsPositiveBigIntId,
  IsPositiveIntId,
} from '../../../common/validation';

export class GetConvDto {
  @ApiPropertyOptional({ type: String, description: 'ID người hội thoại cùng' })
  @IsPositiveBigIntId({ required: false })
  partner_id?: string;

  @ApiPropertyOptional({
    description:
      'ID conversation dạng chuỗi để giữ nguyên độ chính xác của BIGINT',
  })
  @IsPositiveBigIntId({ required: false })
  conversation_id?: string;

  @ApiProperty({ type: Number, description: 'Số thứ tự trang, bắt đầu từ 0' })
  @IsNotEmpty({ message: '1002' })
  @IsInt({ message: '1003' })
  @Min(0, { message: '1004' })
  index: number;

  @ApiProperty({ type: Number, description: 'Số tin nhắn trên một trang' })
  @IsNotEmpty({ message: '1002' })
  @IsInt({ message: '1003' })
  @Min(1, { message: '1004' })
  @Max(100, { message: '1004' })
  count: number;
}
