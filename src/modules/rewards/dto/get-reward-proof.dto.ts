import { IsPositiveBigIntId } from '../../../common/validation';

export class GetRewardProofDto {
  @IsPositiveBigIntId()
  reward_id: string;
}
