import { ApiProperty } from '@nestjs/swagger';
import { IsPositiveBigIntId } from '../../../common/validation';

export class GetProductsDto {
  @ApiProperty()
  @IsPositiveBigIntId()
  id: string;
}
