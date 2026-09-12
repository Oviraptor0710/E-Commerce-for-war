import { IsInt, IsOptional, IsString, IsIn } from 'class-validator';
import { IsPositiveBigIntId } from '../../../common/validation';

export class RespondRefundDto {
  @IsPositiveBigIntId() purchase_id: string;
  @IsInt() @IsIn([0, 1]) is_accept: number;
  @IsOptional() @IsString() seller_response?: string;
}
