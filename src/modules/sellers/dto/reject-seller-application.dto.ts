import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RejectSellerApplicationDto {
  @ApiProperty({ type: String })
  @IsString({ message: '1003' })
  @IsNotEmpty({ message: '1002' })
  reason: string;
}
