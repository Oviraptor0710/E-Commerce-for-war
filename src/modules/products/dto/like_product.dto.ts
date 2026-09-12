import { ApiProperty } from '@nestjs/swagger';
import { IsPositiveBigIntId } from '../../../common/validation';

export class LikeProductDto {
  @ApiProperty()
  @IsPositiveBigIntId()
  product_id: string;
}
