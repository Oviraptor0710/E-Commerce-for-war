import { ApiProperty } from '@nestjs/swagger';

export class PushSettingResponseDataDto {
  @ApiProperty({ type: Number, enum: [0, 1] })
  like!: number;

  @ApiProperty({ type: Number, enum: [0, 1] })
  comment!: number;

  @ApiProperty({ type: Number, enum: [0, 1] })
  transaction!: number;

  @ApiProperty({ type: Number, enum: [0, 1] })
  announcement!: number;

  @ApiProperty({ type: Number, enum: [0, 1] })
  sound_on!: number;

  @ApiProperty({ type: String })
  sound_default!: string;
}
