import { ApiProperty } from '@nestjs/swagger';

export class NewsResponseDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String, nullable: true })
  title!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  created_at!: number | null;

  @ApiProperty({ type: String, nullable: true })
  content!: string | null;
}

export class NewsListResponseDataDto {
  @ApiProperty({ type: () => [NewsResponseDto] })
  list_news!: NewsResponseDto[];

  @ApiProperty({ type: Number })
  total!: number;
}
