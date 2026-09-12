import { Allow } from 'class-validator';
import { IsPositiveBigIntId } from '../../../common/validation';

export class CreateRewardAppealDto {
  @IsPositiveBigIntId()
  reward_id: string;

  @Allow()
  reason: string;
}
