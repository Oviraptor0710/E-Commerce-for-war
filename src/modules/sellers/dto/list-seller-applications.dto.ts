import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { SellerApplicationStatus } from '../enums/seller-application-status.enum';

export class ListSellerApplicationsDto {
  @ApiPropertyOptional({ enum: SellerApplicationStatus })
  @IsOptional()
  @IsEnum(SellerApplicationStatus, { message: '1004' })
  status?: SellerApplicationStatus;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '1003' })
  @Min(0, { message: '1004' })
  index?: number = 0;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '1003' })
  @Min(1, { message: '1004' })
  @Max(100, { message: '1004' })
  count?: number = 20;
}
