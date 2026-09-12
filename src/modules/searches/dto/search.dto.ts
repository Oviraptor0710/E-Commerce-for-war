import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { IsPositiveBigIntId } from '../../../common/validation';

export class SearchDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsPositiveBigIntId({ required: false })
  category_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsPositiveBigIntId({ required: false })
  brand_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  price_min?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  price_max?: number;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  index: number;

  @ApiPropertyOptional()
  @IsInt()
  @Min(1)
  count: number;
}
