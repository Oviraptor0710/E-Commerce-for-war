import { IsNumber, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsPositiveBigIntId } from '../../../common/validation';

export class GetUserListingsDto {
  @ApiProperty({
    description: 'index',
  })
  @IsNumber()
  index: number;

  @ApiProperty({
    description: 'count',
  })
  @IsNumber()
  count: number;

  @ApiProperty({
    description: 'user_id',
  })
  @IsPositiveBigIntId({ required: false })
  user_id: string;

  @ApiProperty({
    description: 'Từ khóa tìm kiếm',
  })
  @IsString()
  @IsOptional()
  keyword: string;

  @ApiProperty({
    description: 'thuộc tính sản phẩm',
  })
  @IsPositiveBigIntId({ required: false })
  category_id: string;
}
