import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';
import { IsNonNegativeBigIntId } from '../../../common/validation';

export class GetCategoriesDto {
  @ApiPropertyOptional({
    description: '0 là root category; nếu không truyền thì lấy tất cả',
  })
  @IsOptional()
  @IsNonNegativeBigIntId({ required: false })
  parent_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  index?: number = 0;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  count?: number = 10;
}
