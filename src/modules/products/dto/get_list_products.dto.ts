import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { IsPositiveBigIntId } from '../../../common/validation';

export class GetListProductsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsPositiveBigIntId({ required: false })
  category_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsPositiveBigIntId({ required: false })
  brand_id?: string;

  @ApiPropertyOptional({
    description: '0: all size',
  })
  @IsOptional()
  @IsInt()
  product_size_id?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  price_min?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  price_max?: number;

  @ApiPropertyOptional({
    description: 'new, like new ...',
  })
  @IsOptional()
  @IsString()
  condition?: string;

  @ApiPropertyOptional({
    description:
      'price_asc | price_desc | created_desc | discount_percent_desc | discount_value_desc | like_desc | comment_desc | distance_asc',
  })
  @IsOptional()
  @IsString()
  order?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  longitude?: number;

  @ApiPropertyOptional({
    description: 'last id trả về lần trước',
  })
  @IsOptional()
  @IsPositiveBigIntId({ required: false })
  last_id?: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  index: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  count: number;
}
