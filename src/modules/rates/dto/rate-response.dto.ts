import { ApiProperty } from '@nestjs/swagger';

export class RateListItemResponseDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String, nullable: true })
  reviewer_id!: string | null;

  @ApiProperty({ type: String, nullable: true })
  username!: string | null;

  @ApiProperty({ type: String, nullable: true })
  avatar!: string | null;

  @ApiProperty({ type: String, nullable: true })
  cover_image!: string | null;

  @ApiProperty({ type: String, nullable: true })
  cover_image_web!: string | null;

  @ApiProperty({ type: String, nullable: true })
  content!: string | null;

  @ApiProperty({ type: Number })
  level!: number;

  @ApiProperty({ type: String, nullable: true })
  product_id!: string | null;

  @ApiProperty({ type: String, nullable: true })
  purchase_id!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  created!: string;
}

export class SetRateResponseDataDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  user_id!: string;

  @ApiProperty({ type: String, nullable: true })
  reviewer_id!: string | null;

  @ApiProperty({ type: String, nullable: true })
  product_id!: string | null;

  @ApiProperty({ type: String, nullable: true })
  purchase_id!: string | null;

  @ApiProperty({ type: Number })
  level!: number;

  @ApiProperty({ type: String, nullable: true })
  content!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  created_at!: string;
}
