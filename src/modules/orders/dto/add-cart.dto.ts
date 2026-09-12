import { IsInt, Min } from 'class-validator';
import { IsPositiveBigIntId } from '../../../common/validation';

export class AddCartDto {
  @IsPositiveBigIntId()
  product_id: string;

  @IsPositiveBigIntId()
  variant_id: string;

  @IsInt()
  @Min(1)
  quantity: number;
}
