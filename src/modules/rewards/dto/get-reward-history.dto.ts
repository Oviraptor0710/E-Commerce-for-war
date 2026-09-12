import { Allow } from 'class-validator';

export class GetRewardHistoryDto {
  @Allow()
  index: number;

  @Allow()
  count: number;
}
