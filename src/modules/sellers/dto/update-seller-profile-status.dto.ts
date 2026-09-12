import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { SellerProfileStatus } from '../enums/seller-profile-status.enum';

export class UpdateSellerProfileStatusDto {
  @ApiProperty({ enum: SellerProfileStatus })
  @IsEnum(SellerProfileStatus, { message: '1004' })
  status: SellerProfileStatus;
}
