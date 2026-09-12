import { IsIn, IsString } from 'class-validator';
import { IsPositiveBigIntId } from '../../../common/validation';

export class SetUserFollowDto {
  @IsPositiveBigIntId()
  followee_id!: string;

  @IsString({ message: '1003' })
  @IsIn(['follow', 'unfollow'], { message: '1004' })
  action!: string;
}
