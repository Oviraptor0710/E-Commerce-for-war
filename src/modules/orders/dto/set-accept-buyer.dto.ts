import { IsInt } from 'class-validator';
import { IsPositiveBigIntId } from '../../../common/validation';

export class SetAcceptBuyerDto {
  @IsPositiveBigIntId()
  purchase_id: string;

  @IsPositiveBigIntId()
  buyer_id: string;

  @IsInt()
  is_accept: number;
}
