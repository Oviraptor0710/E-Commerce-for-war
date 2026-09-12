import { ApiProperty } from '@nestjs/swagger';
import { IsPositiveBigIntId } from '../../../common/validation';

export class GetShipFeeDto {
  @ApiProperty({
    description: 'mã sản phẩm',
  })
  @IsPositiveBigIntId()
  product_id: string;

  @ApiProperty({
    description: 'Mã địa chỉ người dùng',
  })
  @IsPositiveBigIntId({ required: false })
  address_id: string;
}
