import { IsDefined, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class GetListPurchasesSellerDto {
  @IsDefined({ message: '1004' })
  @IsInt({ message: '1004' })
  @Min(0, { message: '1004' })
  index: number;

  @IsDefined({ message: '1004' })
  @IsInt({ message: '1004' })
  @Min(1, { message: '1004' })
  count: number;

  @IsOptional()
  @IsString({ message: '1004' })
  state?: string;
}
