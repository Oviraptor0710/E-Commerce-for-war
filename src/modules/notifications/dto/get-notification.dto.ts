import { Allow, IsInt, IsNotEmpty, Min } from 'class-validator';

export class GetNotiticationDto {
  @Allow()
  @IsNotEmpty({ message: '1002' })
  @IsInt({ message: '1003' })
  @Min(0, { message: '1004' })
  index: number;

  @Allow()
  @IsNotEmpty({ message: '1002' })
  @IsInt({ message: '1003' })
  @Min(1, { message: '1004' })
  count: number;
}
