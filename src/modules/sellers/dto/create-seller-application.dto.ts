import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsPositiveBigIntId } from '../../../common/validation';

export class CreateSellerApplicationDto {
  @ApiProperty({ type: String })
  @IsString({ message: '1003' })
  @IsNotEmpty({ message: '1002' })
  @MaxLength(255, { message: '1004' })
  shop_name: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString({ message: '1003' })
  description?: string;

  @ApiProperty({ type: String })
  @IsPositiveBigIntId()
  ship_from_address_id: string;
}
