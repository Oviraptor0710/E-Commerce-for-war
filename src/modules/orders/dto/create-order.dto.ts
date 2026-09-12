import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { IsPositiveBigIntId } from '../../../common/validation';

export class CreateOrderItemDto {
  @IsPositiveBigIntId() variant_id: string;
  @Type(() => Number) @IsInt() @Min(1) quantity: number;
}

export class CreateOrderDto {
  @IsString() @IsNotEmpty() @MaxLength(150) idempotency_key: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
  @IsPositiveBigIntId() address_id: string;
  @Type(() => Number) @IsInt() @IsIn([0, 1]) order_source: number;
  @IsOptional() @Type(() => Number) @IsInt() @IsIn([0, 1]) source?: number;
}
