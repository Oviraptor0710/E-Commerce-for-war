import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsArray,
  IsNotEmpty,
  MaxLength,
  ValidateNested,
  IsUrl,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateProductVariantDto } from './create_productVariants.dto';
import { IsPositiveBigIntId } from '../../../common/validation';
export class VideoDto {
  @ApiProperty({
    type: String,
    description: 'Đường dẫn video',
  })
  @IsUrl()
  @IsString()
  @IsOptional()
  url: string;
}
export class CreateProductDto {
  @ApiProperty({
    type: String,
    description: 'Product name',
    maxLength: 255,
  })
  @IsString({ message: '1003' })
  @IsNotEmpty({ message: '1002' })
  @MaxLength(255, { message: '1004' })
  title: string;

  @ApiProperty({
    type: String,
    description: 'Product description',
  })
  @IsString({ message: '1003' })
  @IsNotEmpty({ message: '1002' })
  description: string;

  @ApiProperty({
    type: [String],
    description: 'Product image urls',
    required: false,
  })
  @IsArray({ message: '1003' })
  @IsOptional()
  @IsString({ each: true, message: '1003' })
  @MaxLength(255, { each: true, message: '1004' })
  image_urls?: string[];

  @ApiProperty({
    type: String,
    description: 'ID of the brand',
  })
  @IsPositiveBigIntId({ required: false })
  brand_id: string;

  @ApiProperty({
    type: [CreateProductVariantDto],
    description: 'Product variants',
  })
  @IsArray({ message: '1003' })
  @IsNotEmpty({ message: '1002' })
  @ValidateNested({ each: true })
  @Type(() => CreateProductVariantDto)
  variants: CreateProductVariantDto[];

  @ApiProperty({
    type: String,
    description: 'category',
  })
  @IsPositiveBigIntId()
  category_id: string;

  @ApiProperty({
    type: String,
    description: 'ID of the seller shipping address',
  })
  @IsPositiveBigIntId()
  ship_from_id: string;
  @ApiProperty({
    type: [VideoDto],
    description: 'Đường link video và thumb',
  })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => VideoDto)
  videos: VideoDto[];
}
