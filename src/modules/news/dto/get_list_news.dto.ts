import { IsNumber, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class GetListNewsDto {
  @ApiPropertyOptional({
    description: 'index để hiển thị từ trang',
  })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  index?: number;
  @ApiPropertyOptional({
    description: 'Số trang ',
  })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  count?: number;
}
