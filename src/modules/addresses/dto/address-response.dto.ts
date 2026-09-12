import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProvinceResponseDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;
}

export class WardResponseDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String })
  province_id!: string;

  @ApiPropertyOptional({ type: () => ProvinceResponseDto })
  province?: ProvinceResponseDto;
}

export class AddressResponseDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  user_id!: string;

  @ApiProperty({ type: String })
  ward_id!: string;

  @ApiProperty({ type: String, nullable: true })
  address_name!: string | null;

  @ApiProperty({ type: String })
  address_detail!: string;

  @ApiProperty({ type: Boolean })
  is_default!: boolean;

  @ApiProperty({ type: String })
  receiver_name!: string;

  @ApiProperty({ type: String })
  phone!: string;

  @ApiProperty({ type: String })
  full_address!: string;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  deleted_at?: string | null;

  @ApiPropertyOptional({ type: () => WardResponseDto })
  ward?: WardResponseDto;
}
