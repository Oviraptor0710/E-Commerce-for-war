import { IsPositiveBigIntId } from '../../../common/validation';

export class SetReadNotificationDto {
  @IsPositiveBigIntId()
  notification_id: string;
}
