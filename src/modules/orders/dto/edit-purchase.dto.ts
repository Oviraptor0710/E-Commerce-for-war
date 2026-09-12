import { IsOptional, IsString } from 'class-validator';
import { IsPositiveBigIntId } from '../../../common/validation';

export class EditPurchaseDto {
  @IsPositiveBigIntId()
  id: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsPositiveBigIntId({ required: false })
  address_id?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
