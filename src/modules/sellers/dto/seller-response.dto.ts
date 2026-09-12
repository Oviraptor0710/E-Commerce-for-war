import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SellerApplicationStatus } from '../enums/seller-application-status.enum';
import { SellerProfileStatus } from '../enums/seller-profile-status.enum';

export class SellerApplicationResponseDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) applicant_id!: string;
  @ApiProperty({ type: String }) shop_name!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty({ type: String }) ship_from_address_id!: string;
  @ApiProperty({ type: String }) ship_from_full_address_snapshot!: string;
  @ApiProperty({ enum: SellerApplicationStatus }) status!: SellerApplicationStatus;
  @ApiProperty({ type: String, nullable: true }) reviewed_by!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) reviewed_at!: string | null;
  @ApiProperty({ type: String, nullable: true }) rejection_reason!: string | null;
  @ApiProperty({ type: String, format: 'date-time' }) submitted_at!: string;
  @ApiProperty({ type: String, format: 'date-time' }) created_at!: string;
  @ApiProperty({ type: String, format: 'date-time' }) updated_at!: string;
  @ApiPropertyOptional({ type: Object }) applicant?: Record<string, unknown>;
  @ApiPropertyOptional({ type: Object, nullable: true }) reviewer?: Record<string, unknown> | null;
  @ApiPropertyOptional({ type: Object }) ship_from_address?: Record<string, unknown>;
}

export class SellerProfileResponseDto {
  @ApiProperty({ type: String }) user_id!: string;
  @ApiProperty({ type: String }) approved_application_id!: string;
  @ApiProperty({ type: String }) shop_name!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty({ type: String }) default_ship_from_address_id!: string;
  @ApiProperty({ enum: SellerProfileStatus }) status!: SellerProfileStatus;
  @ApiProperty({ type: String, format: 'date-time' }) approved_at!: string;
  @ApiProperty({ type: String, format: 'date-time' }) created_at!: string;
  @ApiProperty({ type: String, format: 'date-time' }) updated_at!: string;
  @ApiPropertyOptional({ type: Object }) default_ship_from_address?: Record<string, unknown>;
}

export class SellerApplicationListResponseDataDto {
  @ApiProperty({ type: () => [SellerApplicationResponseDto] }) applications!: SellerApplicationResponseDto[];
  @ApiProperty({ type: Number }) total!: number;
}

export class SellerApplicationApprovalResponseDataDto {
  @ApiProperty({ type: String }) application_id!: string;
  @ApiProperty({ type: () => SellerProfileResponseDto }) profile!: SellerProfileResponseDto;
}
