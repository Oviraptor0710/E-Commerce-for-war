import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';
import { IsPositiveBigIntId } from '../../../common/validation';

export class CreateOrderItemDto {
  @IsPositiveBigIntId()
  product_id: string;

  @IsPositiveBigIntId()
  variant_id: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @IsPositiveBigIntId()
  address_id: string;

  // Theo đặc tả:
  // 0 = tạo đơn từ giỏ hàng
  // 1 = tạo đơn trực tiếp từ sản phẩm
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 1])
  order_source: number;

  // Giữ lại để không vỡ nếu FE/mobile cũ vẫn gửi source
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 1])
  source?: number;
}
