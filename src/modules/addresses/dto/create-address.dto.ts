import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { IsPositiveBigIntId } from '../../../common/validation';

export class CreateAddressDto {
  @ApiProperty({ type: String, description: 'ID tỉnh/thành phố' })
  @IsPositiveBigIntId()
  province_id: string;

  @ApiProperty({ type: String, description: 'ID phường/xã' })
  @IsPositiveBigIntId()
  ward_id: string;

  @ApiProperty({ type: String, description: 'Địa chỉ chi tiết' })
  @IsString({ message: '1003' })
  @IsNotEmpty({ message: '1002' })
  address_detail: string;

  @ApiProperty({ type: String })
  @IsString({ message: '1003' })
  @IsNotEmpty({ message: '1002' })
  receiver_name: string;

  @ApiProperty({ type: String })
  @IsString({ message: '1003' })
  @IsNotEmpty({ message: '1002' })
  @MaxLength(30, { message: '1004' })
  phone: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString({ message: '1003' })
  @MaxLength(100, { message: '1004' })
  address_name?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean({ message: '1003' })
  is_default?: boolean = false;
}
