import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserDefaultAddressResponseDto {
  @ApiProperty({
    type: String,
    description:
      'ID địa chỉ, biểu diễn dưới dạng chuỗi vì database dùng BIGINT.',
  })
  address_id!: string;

  @ApiProperty({
    type: String,
  })
  address!: string;

  @ApiProperty({
    type: Boolean,
    description: 'Địa chỉ có hỗ trợ lấy hàng hay không.',
  })
  pick_support!: boolean;
}

export class GetUserInfoDataResponseDto {
  @ApiProperty({
    type: String,
    description:
      'ID người dùng, biểu diễn dưới dạng chuỗi vì database dùng BIGINT.',
  })
  id!: string;

  @ApiProperty({ type: String })
  username!: string;

  @ApiProperty({ type: Number, description: 'Số lượng đơn bán của người dùng.' })
  listing!: number;

  @ApiProperty({ type: Number })
  followers!: number;

  @ApiProperty({ type: Number })
  following!: number;

  @ApiProperty({ type: String })
  status!: string;

  @ApiProperty({
    type: String,
    nullable: true,
  })
  avatar!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
  })
  cover_image!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
  })
  cover_image_web!: string | null;

  @ApiProperty({
    type: Boolean,
    description: 'Tài khoản hiện tại có theo dõi người dùng này hay không.',
  })
  followed!: boolean;

  @ApiProperty({
    type: Boolean,
    description: 'Tài khoản hiện tại có chặn người dùng này hay không.',
  })
  is_blocked!: boolean;

  @ApiProperty({
    type: Number,
    enum: [0, 1],
    description: 'Trạng thái trực tuyến do API hiện tại trả về.',
  })
  online!: number;

  @ApiPropertyOptional({
    type: () => UserDefaultAddressResponseDto,
    description: 'Chỉ xuất hiện khi người dùng có địa chỉ được lưu.',
  })
  default_address?: UserDefaultAddressResponseDto;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Chỉ xuất hiện khi người dùng xem thông tin của chính mình.',
  })
  email?: string | null;

  @ApiPropertyOptional({
    type: String,
    description: 'Chỉ xuất hiện khi người dùng xem thông tin của chính mình.',
  })
  phonenumber?: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Chỉ xuất hiện khi người dùng xem thông tin của chính mình.',
  })
  firstname?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Chỉ xuất hiện khi người dùng xem thông tin của chính mình.',
  })
  lastname?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Chỉ xuất hiện khi người dùng xem thông tin của chính mình.',
  })
  address?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Chỉ xuất hiện khi người dùng xem thông tin của chính mình.',
  })
  city?: string | null;
}

export class GetUserInfoResponseDto {
  @ApiProperty({ type: String })
  code!: string;

  @ApiProperty({ type: String })
  message!: string;

  @ApiProperty({
    type: () => GetUserInfoDataResponseDto,
    nullable: true,
  })
  data!: GetUserInfoDataResponseDto | null;
}

export class SetUserInfoResponseDataDto {
  @ApiProperty({ type: String, nullable: true })
  avatar!: string | null;

  @ApiProperty({ type: String, nullable: true })
  cover_image!: string | null;

  @ApiProperty({ type: String, nullable: true })
  cover_image_web!: string | null;
}
