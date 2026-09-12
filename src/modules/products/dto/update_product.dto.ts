import { PartialType, ApiProperty } from '@nestjs/swagger';
import { CreateProductDto } from './create_product.dto';
import { IsString, IsArray, MaxLength, IsOptional } from 'class-validator';
export class UpdateProductDto extends PartialType(CreateProductDto) {
  @ApiProperty({
    description: 'delete product image url',
    type: [String],
    required: false,
  })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  @MaxLength(255, { each: true })
  image_urls_del?: string[];

  @ApiProperty({
    description: 'Khóa idempotency cho lần điều chỉnh tồn kho này',
    required: false,
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  idempotency_key?: string;
}
