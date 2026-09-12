import { ApiProperty } from '@nestjs/swagger';

export class SavedSearchResponseDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  user_id!: string;

  @ApiProperty({ type: String, nullable: true })
  keyword!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  created_at!: string;
}
