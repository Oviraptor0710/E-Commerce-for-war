import { ApiProperty } from '@nestjs/swagger';
import { IsPositiveBigIntId } from '../../../common/validation';

export class GetOrderStatusDto {
  /*@ApiProperty({
    description: 'mã sản phẩm',
  })
  @IsNotEmpty()
  @IsNumber()
  product_id: number;*/
  @ApiProperty({
    description: 'mã đơn hàng',
  })
  @IsPositiveBigIntId()
  purchase_id: string;
}
