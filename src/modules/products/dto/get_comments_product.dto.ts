import { ApiProperty } from '@nestjs/swagger';
import { IsPositiveBigIntId } from '../../../common/validation';
import { IsInt, Max, Min } from 'class-validator';

export class GetCommentsProductDto {
  @ApiProperty()
  @IsPositiveBigIntId()
  product_id: string;

  @ApiProperty()
  @IsInt({ message: '1003' })
  @Min(0, { message: '1004' })
  index: number;

  @ApiProperty()
  @IsInt({ message: '1003' })
  @Min(1, { message: '1004' })
  @Max(50, { message: '1004' })
  count: number;
}
