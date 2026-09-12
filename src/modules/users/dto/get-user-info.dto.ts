import { ApiProperty } from '@nestjs/swagger';
import { IsNonNegativeBigIntId } from '../../../common/validation';

export class GetUserInfoDto {
  @ApiProperty({
    type: String,
    description:
      'ID người dùng cần xem, biểu diễn dưới dạng chuỗi vì database dùng BIGINT. Truyền "0" để lấy thông tin của tài khoản đang đăng nhập.',
  })
  @IsNonNegativeBigIntId()
  user_id!: string;
}
