import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CurrentBalanceResponseDataDto {
  @ApiProperty({ type: String, description: 'Số điểm khả dụng, DECIMAL(20,3).' })
  balance!: string;

  @ApiProperty({ type: String, description: 'Số điểm khả dụng, DECIMAL(20,3).' })
  available_balance!: string;

  @ApiProperty({ type: String, description: 'Số điểm đang chờ quyết toán, DECIMAL(20,3).' })
  pending_balance!: string;
}

export class BalanceHistoryItemResponseDto {
  @ApiPropertyOptional({ type: String })
  wallet_entry_id?: string;

  @ApiPropertyOptional({ type: String })
  transaction_id?: string;

  @ApiProperty({ type: String, nullable: true })
  object_id!: string | null;

  @ApiProperty({ type: String })
  title!: string;

  @ApiProperty({ type: String })
  detail!: string;

  @ApiProperty({ type: String, description: 'Giá trị thay đổi điểm, DECIMAL(20,3).' })
  balance!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  date!: string;

  @ApiProperty({ type: String })
  type!: string;
}
