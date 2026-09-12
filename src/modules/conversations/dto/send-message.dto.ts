import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { MessageType } from '../enums/message-type.enum';
import { IsPositiveBigIntId } from '../../../common/validation';

export class SendMessageDto {
  @ApiProperty({ type: String, description: 'ID người nhận tin nhắn' })
  @IsPositiveBigIntId()
  to_id: string;

  @ApiProperty({
    description:
      'ID duy nhất do client tạo; gửi lại cùng ID không tạo trùng tin nhắn',
  })
  @IsString({ message: '1003' })
  @IsNotEmpty({ message: '1002' })
  @MaxLength(100, { message: '1004' })
  client_message_id: string;

  @ApiPropertyOptional({ description: 'Nội dung hoặc URL media' })
  @IsOptional()
  @IsString({ message: '1003' })
  @MaxLength(10000, { message: '1004' })
  message?: string;

  @ApiPropertyOptional({
    enum: MessageType,
    description: 'Kiểu tin nhắn; không cần truyền khi gửi product_id',
  })
  @ValidateIf((dto: SendMessageDto) => dto.product_id === undefined)
  @IsEnum(MessageType, { message: '1004' })
  @IsNotEmpty({ message: '1002' })
  type_message?: MessageType;

  @ApiPropertyOptional({ type: String, description: 'ID sản phẩm được chia sẻ' })
  @IsPositiveBigIntId({ required: false })
  product_id?: string;
}
