import { ApiProperty } from '@nestjs/swagger';

export class AuthSessionResponseDataDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  username!: string;

  @ApiProperty({ type: String })
  token!: string;

  @ApiProperty({ type: String, nullable: true })
  avatar!: string | null;

  @ApiProperty({ type: String, nullable: true })
  cover_image!: string | null;

  @ApiProperty({ type: String, nullable: true })
  cover_image_web!: string | null;

  @ApiProperty({ type: Number })
  active!: number;
}

export class SignupResponseDataDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  username!: string;

  @ApiProperty({ type: String })
  wallet_id!: string;

  @ApiProperty({ type: String, nullable: true })
  avatar!: string | null;

  @ApiProperty({ type: Number })
  active!: number;
}

export class ResetPasswordOtpResponseDataDto {
  @ApiProperty({ type: String })
  otp!: string;
}

export class AuthenticatedUserResponseDataDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  userId!: string;

  @ApiProperty({ type: String })
  username!: string;

  @ApiProperty({ type: String })
  role!: string;
}

export class ChangeInfoAfterSignupResponseDataDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  username!: string;

  @ApiProperty({ type: String })
  phone_number!: string;

  @ApiProperty({ type: String })
  password!: string;

  @ApiProperty({ type: String, nullable: true })
  uuid!: string | null;

  @ApiProperty({ type: String })
  role!: string;

  @ApiProperty({ type: String, nullable: true })
  fullname!: string | null;

  @ApiProperty({ type: String, nullable: true })
  avatar!: string | null;
}
