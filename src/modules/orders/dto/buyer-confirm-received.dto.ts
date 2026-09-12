import { IsOptional, IsString } from 'class-validator';
import { IsPositiveBigIntId } from '../../../common/validation';

export class BuyerConfirmReceivedDto {
  @IsPositiveBigIntId()
  purchase_id: string;

  @IsOptional()
  @IsString()
  state?: string;
}
