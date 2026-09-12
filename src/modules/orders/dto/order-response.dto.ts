import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '../enums/order-status.enum';
import { RefundDecisionSource } from '../enums/refund-decision-source.enum';
import { RefundStatus } from '../enums/refund-status.enum';

export class OrderProvinceResponseDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) name!: string;
}

export class OrderWardResponseDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: String }) province_id!: string;
}

export class ShipFromAddressResponseDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: String }) full_address!: string;
  @ApiProperty({ type: String }) receiver_name!: string;
  @ApiProperty({ type: String }) phone!: string;
  @ApiProperty({ type: String, enum: ['0', '1'] }) is_default!: string;
}

export class ShipFeeResponseDto {
  @ApiProperty({ type: Number }) ship_fee!: number;
  @ApiProperty({ type: Number }) shipping_fee!: number;
  @ApiProperty({ type: Number }) leatime!: number;
  @ApiPropertyOptional({ type: Number, nullable: true }) distance?: number | null;
}

export class CheckoutOrderResponseDto {
  @ApiProperty({ type: String }) order_id!: string;
  @ApiProperty({ enum: OrderStatus }) status!: OrderStatus;
  @ApiProperty({ type: Number }) total_price!: number;
  @ApiProperty({ type: Number }) shipping_fee!: number;
  @ApiProperty({ type: Number }) final_price!: number;
  @ApiPropertyOptional({ type: String }) address_id?: string;
  @ApiPropertyOptional({ type: Number, enum: [0, 1] }) order_source?: number;
  @ApiPropertyOptional({ type: Number, enum: [0, 1] }) source?: number;
}

export class PurchaseItemResponseDto {
  @ApiProperty({ type: String }) product_id!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: String, nullable: true }) image!: string | null;
  @ApiProperty({ type: Number }) price!: number;
  @ApiProperty({ type: String }) variant_id!: string;
  @ApiPropertyOptional({ type: Number }) quantity?: number;
  @ApiPropertyOptional({ type: Number }) subtotal?: number;
}

export class PurchaseListItemResponseDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ enum: OrderStatus }) state!: OrderStatus;
  @ApiProperty({ type: Number }) total_price!: number;
  @ApiProperty({ type: () => PurchaseItemResponseDto, isArray: true }) items!: PurchaseItemResponseDto[];
}

export class SellerPurchaseListItemResponseDto extends PurchaseListItemResponseDto {
  @ApiProperty({ type: String }) buyerId!: string;
}

export class CartProductResponseDto {
  @ApiProperty({ type: String }) cart_item_id!: string;
  @ApiProperty({ type: String }) product_id!: string;
  @ApiProperty({ type: String }) variant_id!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: String }) image!: string;
  @ApiProperty({ type: String, description: 'Giá DECIMAL(20,3) được trả dưới dạng chuỗi.' }) price!: string;
  @ApiProperty({ type: Number }) quantity!: number;
  @ApiProperty({ type: String, description: 'Tạm tính DECIMAL(20,3) được trả dưới dạng chuỗi.' }) subtotal!: string;
}

export class CartShopResponseDto {
  @ApiProperty({ type: String }) shop_id!: string;
  @ApiProperty({ type: String }) shop_name!: string;
  @ApiProperty({ type: String }) shop_avatar!: string;
  @ApiProperty({ type: () => CartProductResponseDto, isArray: true }) items!: CartProductResponseDto[];
  @ApiProperty({ type: String, description: 'Tổng tiền shop, dạng DECIMAL(20,3).' }) shop_total!: string;
}

export class CartMutationResponseDto {
  @ApiProperty({ type: String }) cart_item_id!: string;
  @ApiPropertyOptional({ type: String }) product_id?: string;
  @ApiPropertyOptional({ type: String }) variant_id?: string;
  @ApiProperty({ type: Number }) quantity!: number;
  @ApiProperty({ type: String, description: 'Tạm tính DECIMAL(20,3).' }) subtotal!: string;
}

export class OrderTimelineResponseDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) purchase_id!: string;
  @ApiProperty({ enum: OrderStatus }) state!: OrderStatus;
  @ApiProperty({ type: String, nullable: true }) note!: string | null;
  @ApiProperty({ type: String, format: 'date-time' }) created_at!: string;
}

export class OrderStatusHistoryResponseDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) order_id!: string;
  @ApiProperty({ enum: OrderStatus, nullable: true }) previous_status!: OrderStatus | null;
  @ApiProperty({ enum: OrderStatus }) new_status!: OrderStatus;
  @ApiProperty({ type: String }) change_source!: string;
  @ApiProperty({ type: String, nullable: true }) changed_by!: string | null;
  @ApiProperty({ type: String, nullable: true }) note!: string | null;
  @ApiProperty({ type: String, format: 'date-time' }) created_at!: string;
}

export class OrderStatusProductResponseDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: Number }) price!: number;
  @ApiProperty({ type: String }) variant_id!: string;
  @ApiProperty({ type: String, nullable: true }) image!: string | null;
  @ApiProperty({ type: Object, isArray: true }) video!: Record<string, unknown>[];
}

export class OrderStatusResponseDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) ship_from!: string;
  @ApiProperty({ type: String }) ship_to!: string;
  @ApiProperty({ type: String, description: 'Giá DECIMAL(20,3) từ entity Order.' }) price!: string;
  @ApiProperty({ type: String, description: 'Phí ship DECIMAL(20,3) từ entity Order.' }) ship_fee!: string;
  @ApiProperty({ type: String, format: 'date-time' }) create!: string;
  @ApiProperty({ type: Number, nullable: true }) leatime!: number | null;
  @ApiProperty({ enum: OrderStatus }) current_status!: OrderStatus;
  @ApiProperty({ type: () => OrderStatusHistoryResponseDto, isArray: true }) status_history!: OrderStatusHistoryResponseDto[];
  @ApiProperty({ type: () => OrderStatusProductResponseDto, isArray: true }) products!: OrderStatusProductResponseDto[];
}

export class PurchasePartyResponseDto {
  @ApiProperty({ type: String, nullable: true }) id!: string | null;
  @ApiProperty({ type: String }) name!: string;
}

export class PurchaseBuyerResponseDto extends PurchasePartyResponseDto {
  @ApiProperty({ type: String }) phonenumber!: string;
  @ApiProperty({ type: String }) address!: string;
}

export class PurchaseDetailResponseDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ enum: OrderStatus }) state!: OrderStatus;
  @ApiProperty({ type: Number }) total_price!: number;
  @ApiProperty({ type: Number }) ship_fee!: number;
  @ApiProperty({ type: Number }) final_price!: number;
  @ApiProperty({ type: String }) note!: string;
  @ApiProperty({ type: () => PurchaseItemResponseDto, isArray: true }) items!: PurchaseItemResponseDto[];
  @ApiProperty({ type: () => PurchasePartyResponseDto }) seller!: PurchasePartyResponseDto;
  @ApiProperty({ type: () => PurchaseBuyerResponseDto }) buyer!: PurchaseBuyerResponseDto;
}

export class EditPurchaseResponseDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ enum: OrderStatus }) state!: OrderStatus;
  @ApiProperty({ type: String }) note!: string;
  @ApiProperty({ type: String }) address_id!: string;
  @ApiProperty({ type: String }) address!: string;
}

export class CancelOrderResponseDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ enum: OrderStatus }) state!: OrderStatus;
  @ApiProperty({ type: String, nullable: true }) cancel_reason!: string | null;
  @ApiProperty({ type: Number }) refunded_coins!: number;
  @ApiProperty({ type: String, format: 'date-time' }) refunded_at!: string;
}

export class RefundOrderResponseDto {
  @ApiProperty({ type: String }) refund_id!: string;
  @ApiProperty({ enum: RefundStatus }) status!: RefundStatus;
  @ApiPropertyOptional({ type: String, format: 'date-time' }) seller_response_deadline?: string;
}

export class RespondRefundResponseDto extends RefundOrderResponseDto {
  @ApiPropertyOptional({ enum: RefundDecisionSource }) decision_source?: RefundDecisionSource;
}
