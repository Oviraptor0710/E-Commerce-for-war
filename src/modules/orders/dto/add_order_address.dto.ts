import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsOptional,
  IsString,
} from 'class-validator';
import { IsPositiveBigIntId } from '../../../common/validation';

/** @deprecated Prefer the /addresses endpoints. Kept for legacy clients. */
export class AddOrderAddressDto {
  @ApiPropertyOptional({ description: 'Tên gợi nhớ cho địa chỉ' })
  @IsOptional()
  @IsString({ message: '1003' })
  address?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean({ message: '1003' })
  is_default?: boolean = false;

  @ApiProperty({ description: 'Mảng ID dạng chuỗi theo thứ tự [ward_id, province_id]' })
  @IsDefined({ message: '1002' })
  @IsArray({ message: '1003' })
  @ArrayMinSize(2, { message: '1004' })
  @IsString({ each: true, message: '1003' })
  address_id: string[];

  @ApiProperty({ description: 'Họ và tên người nhận' })
  @IsDefined({ message: '1002' })
  @IsString({ message: '1003' })
  receiver_name: string;

  @ApiProperty({ description: 'Số điện thoại' })
  @IsDefined({ message: '1002' })
  @IsString({ message: '1003' })
  phone: string;

  @ApiProperty({ description: 'Địa chỉ chi tiết' })
  @IsDefined({ message: '1002' })
  @IsString({ message: '1003' })
  address_detail: string;
}
