import { IsInt, Min } from 'class-validator';
import { IsPositiveBigIntId } from '../../../common/validation';

export class EditCartDto {
  @IsPositiveBigIntId()
  cart_item_id: string;

  @IsInt()
  @Min(1)
  quantity: number;
}
