import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

export class GetListConvDto {
  @ApiProperty({ type: Number, description: 'Số thứ tự trang, bắt đầu từ 0' })
  @IsInt({ message: '1003' })
  @Min(0, { message: '1004' })
  index: number;

  @ApiProperty({ type: Number, description: 'Số conversation trên một trang' })
  @IsInt({ message: '1003' })
  @Min(1, { message: '1004' })
  @Max(100, { message: '1004' })
  count: number;
}
