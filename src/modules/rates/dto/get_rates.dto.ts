import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { IsPositiveBigIntId } from '../../../common/validation';

export class GetRatesDto {
  @ApiPropertyOptional()
  @IsPositiveBigIntId({ required: false })
  user_id?: string;

  @ApiPropertyOptional()
  @IsPositiveBigIntId({ required: false })
  product_id?: string;

  @ApiPropertyOptional()
  @IsPositiveBigIntId({ required: false })
  purchase_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5)
  level?: number;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  index: number;

  @ApiPropertyOptional()
  @IsInt()
  @Min(1)
  count: number;
}
