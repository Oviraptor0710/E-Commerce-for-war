import { IsString, IsInt, Min, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsPositiveBigIntId } from '../../../common/validation';
export class CreateProductVariantDto {
  @ApiProperty({
    description: 'variant id (optional when create)',
    required: false,
  })
  @IsPositiveBigIntId({ required: false })
  id?: string;
  @ApiProperty({
    description: 'kích cỡ của mặt hàng',
  })
  @IsOptional()
  @IsString({ message: '1003' })
  size?: string;

  @ApiProperty({
    description: 'số hàng trong kho',
    type: Number,
  })
  @IsInt({ message: '1003' })
  @Min(0, { message: '1004' })
  stock: number;

  @ApiProperty({
    description: 'Giá niêm yết của variant',
    type: Number,
    minimum: 0,
  })
  @IsNumber({}, { message: '1003' })
  @Min(0, { message: '1004' })
  price: number;

  @ApiProperty({
    description: 'Giá bán sau giảm; bỏ trống nếu không giảm giá',
    type: Number,
    required: false,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: '1003' })
  @Min(0, { message: '1004' })
  discount_price?: number;

  @ApiProperty({
    description: 'Màu sắc',
  })
  @IsOptional()
  @IsString({ message: '1003' })
  color?: string;

  @ApiProperty({
    description: 'Khối lượng',
    type: Number,
  })
  @IsOptional()
  @IsNumber({}, { message: '1003' })
  @Min(0, { message: '1004' })
  weight?: number;
}
