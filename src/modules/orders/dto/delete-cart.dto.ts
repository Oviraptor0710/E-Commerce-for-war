import { IsPositiveBigIntId } from '../../../common/validation';

export class DeleteCartDto {
  @IsPositiveBigIntId()
  cart_item_id: string;
}
