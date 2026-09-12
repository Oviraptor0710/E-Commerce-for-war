import { IsInt, Min } from 'class-validator';
import { IsPositiveBigIntId } from '../../../common/validation';

export class GetListFollowingDto {
  @IsPositiveBigIntId()
  user_id!: string;

  @IsInt({ message: '1003' })
  @Min(0, { message: '1004' })
  index!: number;

  @IsInt({ message: '1003' })
  @Min(1, { message: '1004' })
  count!: number;
}
