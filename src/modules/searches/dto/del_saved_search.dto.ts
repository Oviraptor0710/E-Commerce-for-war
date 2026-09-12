import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { IsNonNegativeBigIntId } from '../../../common/validation';

export class DelSavedSearchDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({
    description: 'Nếu search_id = 0 thì xóa toàn bộ lịch sử tìm kiếm',
  })
  @IsOptional()
  @IsNonNegativeBigIntId({ required: false })
  search_id?: string;
}
