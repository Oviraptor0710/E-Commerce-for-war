import { IsInt, Min } from 'class-validator';

export class GetBalanceHistoryDto {
  @IsInt({ message: '1003' })
  @Min(0, { message: '1004' })
  index: number;

  @IsInt({ message: '1003' })
  @Min(1, { message: '1004' })
  count: number;
}
