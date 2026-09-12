import { IsString, IsEmail, IsOptional } from 'class-validator';

export class SetUserInfoDto {
  @IsOptional()
  @IsEmail()
  email!: string | null;

  @IsOptional()
  @IsString()
  username!: string;

  @IsOptional()
  @IsString()
  status!: string;

  @IsOptional()
  @IsString()
  avatar!: string;

  @IsOptional()
  @IsString()
  firstname!: string;

  @IsOptional()
  @IsString()
  lastname!: string;

  @IsOptional()
  @IsString()
  address!: string;

  @IsOptional()
  @IsString()
  cover_image!: string;

  @IsOptional()
  @IsString()
  cover_image_web!: string;
}
