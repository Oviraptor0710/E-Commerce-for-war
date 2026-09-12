import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';
//Header để Authorization: Bearer <token>

export class SetPushSettingDto {
  @IsOptional()
  @IsInt({ message: '1003' })
  @IsIn([0, 1], { message: '1004' })
  like?: number;

  @IsOptional()
  @IsInt({ message: '1003' })
  @IsIn([0, 1], { message: '1004' })
  comment?: number;

  @IsOptional()
  @IsInt({ message: '1003' })
  @IsIn([0, 1], { message: '1004' })
  transaction?: number;

  @IsOptional()
  @IsInt({ message: '1003' })
  @IsIn([0, 1], { message: '1004' })
  announcement?: number;

  @IsOptional()
  @IsInt({ message: '1003' })
  @IsIn([0, 1], { message: '1004' })
  sound_on?: number;

  @IsOptional()
  @IsString({ message: '1003' })
  sound_default?: string;
}
