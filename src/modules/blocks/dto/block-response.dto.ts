import { ApiProperty } from '@nestjs/swagger';

export class BlockListItemResponseDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String, nullable: true })
  image!: string | null;
}
