import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsString, Max, Min } from 'class-validator';
import { IsPositiveBigIntId } from '../../../common/validation';

export class SetRateDto {
  @ApiProperty()
  @IsPositiveBigIntId()
  user_id: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(5)
  level: number;

  @ApiProperty()
  @IsString()
  content: string;

  @ApiPropertyOptional()
  @IsPositiveBigIntId({ required: false })
  product_id?: string;

  @ApiPropertyOptional()
  @IsPositiveBigIntId({ required: false })
  purchase_id?: string;
}
