import { IsDefined, IsOptional, IsNumber, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsPositiveBigIntId,
  ParsePositiveBigIntIdPipe,
} from '../../../common/validation';

const positiveBigIntIdPipe = new ParsePositiveBigIntIdPipe();

export class GetShipFromQueryDto {
  @ApiProperty({
    description: 'level mã địa chỉ',
    required: false,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: '1003' })
  level: number = 0;

  @ApiProperty({ type: Number })
  @IsDefined({ message: '1002' })
  @Type(() => Number)
  @IsNumber({}, { message: '1003' })
  @Min(0, { message: '1004' })
  index: number;

  @ApiProperty({ type: Number })
  @IsDefined({ message: '1002' })
  @Type(() => Number)
  @IsNumber({}, { message: '1003' })
  @Min(1, { message: '1004' })
  count: number;

  @ApiProperty({
    description: 'mã tỉnh hoặc mã phường',
  })
  @Transform(({ value }: { value: unknown }) =>
    positiveBigIntIdPipe.transform(value),
  )
  @IsPositiveBigIntId()
  parent_id: string;
}
