import { IsOptional, IsString } from 'class-validator';
import { IsPositiveBigIntId } from '../../../common/validation';

export class RefundOrderDto {
  @IsPositiveBigIntId()
  purchase_id: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
