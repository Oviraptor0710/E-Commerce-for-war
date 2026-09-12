import { IsPositiveBigIntId } from '../../../common/validation';

export class GetOrderTimelineDto {
  @IsPositiveBigIntId()
  purchase_id: string;
}
