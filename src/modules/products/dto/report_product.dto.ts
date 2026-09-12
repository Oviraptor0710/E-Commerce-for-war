import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IsPositiveBigIntId } from '../../../common/validation';

export class ReportProductDto {
  @ApiProperty()
  @IsPositiveBigIntId()
  product_id: string;

  @ApiProperty()
  @IsString()
  subject: string;

  @ApiProperty()
  @IsString()
  details: string;
}
