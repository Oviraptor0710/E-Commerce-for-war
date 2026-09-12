import { IsPositiveBigIntId } from '../../../common/validation';

export class GetPurchaseDto {
  @IsPositiveBigIntId()
  id: string;
}
