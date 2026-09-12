import { ApiProperty } from '@nestjs/swagger';

export class SetUserFollowResponseDataDto {
  @ApiProperty({ type: String })
  followee_id!: string;

  @ApiProperty({ type: Boolean })
  is_following!: boolean;

  @ApiProperty({ type: Number })
  follow_count!: number;

  @ApiProperty({ type: Number })
  following_count!: number;
}

export class FollowListItemResponseDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  username!: string;

  @ApiProperty({ type: String, nullable: true })
  image!: string | null;

  @ApiProperty({ type: Number, enum: [0, 1] })
  followed!: number;
}
