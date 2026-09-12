import { IsIn, IsInt } from 'class-validator';
import { IsPositiveBigIntId } from '../../../common/validation';

export class SetUserBlockDto {
  @IsPositiveBigIntId()
  user_id!: string;

  @IsInt({ message: '1003' })
  @IsIn([0, 1], { message: '1004' })
  type!: number; // 0 = block, 1 = unblock
}
