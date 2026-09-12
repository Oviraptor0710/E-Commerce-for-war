import { IsPositiveBigIntId } from '../../../common/validation';

export class SellerMarkAsShippedDto {
  @IsPositiveBigIntId()
  purchase_id: string;

  @IsPositiveBigIntId()
  buyer_id: string;
}
