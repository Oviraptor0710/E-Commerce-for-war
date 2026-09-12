import { IsOptional, IsString } from 'class-validator';
import { IsPositiveBigIntId } from '../../../common/validation';

export class CancelOrderDto {
  @IsPositiveBigIntId()
  id: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
