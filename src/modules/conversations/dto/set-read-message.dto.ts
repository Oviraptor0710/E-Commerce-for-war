import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsPositiveBigIntId,
  IsPositiveIntId,
} from '../../../common/validation';

export class SetReadMessageDto {
  @ApiPropertyOptional({
    description:
      'ID conversation dạng chuỗi để giữ nguyên độ chính xác của BIGINT',
  })
  @IsPositiveBigIntId({ required: false })
  conversation_id?: string;

  @ApiPropertyOptional({
    description: 'ID người hội thoại cùng; hỗ trợ tương thích API cũ',
  })
  @IsPositiveBigIntId({ required: false })
  partner_id?: string;

  @ApiProperty({
    description:
      'ID tin nhắn cuối cùng thực sự hiển thị cho người đọc; truyền dạng chuỗi để không mất độ chính xác BIGINT',
  })
  @IsPositiveBigIntId()
  last_read_message_id: string;
}
