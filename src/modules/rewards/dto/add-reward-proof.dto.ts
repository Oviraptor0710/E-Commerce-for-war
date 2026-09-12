import { ApiProperty } from '@nestjs/swagger';
import { Allow, IsString, Matches } from 'class-validator';

export class AddRewardProofDto {
  @IsString({ message: '1003' })
  @Matches(/\S/, { message: '1004' })
  video_url!: string;

  @ApiProperty({
    type: String,
    description: 'mô tả về chiến công, chú ý cả về số lượng đối tượng',
  })
  @Allow()
  @IsString({ message: '1003' })
  @Matches(/\S/, { message: '1004' })
  description: string;
}
