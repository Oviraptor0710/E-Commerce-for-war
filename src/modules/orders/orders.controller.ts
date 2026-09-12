import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ApiDataResponse } from '../../common/swagger/api-data-response.decorator';
import { AddressResponseDto } from '../addresses/dto/address-response.dto';
import { AuthGuard } from '../../common/auth/guards/auth.guard';
import { OrdersService } from './orders.service';
import { GetShipFromQueryDto } from './dto/ship_from.dto';
import { GetShipFeeDto } from './dto/getshipfee.dto';
import { AddOrderAddressDto } from './dto/add_order_address.dto';
import { UpdateOrderAddressDto } from './dto/update_order_address.dto';
import { GetOrderStatusDto } from './dto/get_order_status.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { GetListPurchasesDto } from './dto/get-list-purchases.dto';
import { GetPurchaseDto } from './dto/get-purchase.dto';
import { EditPurchaseDto } from './dto/edit-purchase.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { SetAcceptBuyerDto } from './dto/set-accept-buyer.dto';
import { BuyerConfirmReceivedDto } from './dto/buyer-confirm-received.dto';
import { RefundOrderDto } from './dto/refund-order.dto';
import { SellerMarkAsShippedDto } from './dto/seller-mark-as-shipped.dto';
import { GetOrderTimelineDto } from './dto/get-order-timeline.dto';
import { AddCartDto } from './dto/add-cart.dto';
import { EditCartDto } from './dto/edit-cart.dto';
import { DeleteCartDto } from './dto/delete-cart.dto';
import { GetListPurchasesSellerDto } from './dto/get_list_purchases_seller.dto';
import { RespondRefundDto } from './dto/respond-refund.dto';
import { ParsePositiveBigIntIdPipe } from '../../common/validation';
import {
  CancelOrderResponseDto,
  CartMutationResponseDto,
  CartShopResponseDto,
  CheckoutOrderResponseDto,
  EditPurchaseResponseDto,
  OrderProvinceResponseDto,
  OrderStatusResponseDto,
  OrderTimelineResponseDto,
  OrderWardResponseDto,
  PurchaseDetailResponseDto,
  PurchaseListItemResponseDto,
  RefundOrderResponseDto,
  RespondRefundResponseDto,
  SellerPurchaseListItemResponseDto,
  ShipFeeResponseDto,
  ShipFromAddressResponseDto,
} from './dto/order-response.dto';
interface RequestWithUser extends Request {
  user?: {
    id?: string;
    userId?: string;
  };
}

@Controller()
@ApiBearerAuth('JWT-auth')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  private getUserId(req: RequestWithUser): string {
    return req.user?.id ?? req.user?.userId ?? '';
  }

  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: 'Lấy danh sách địa chỉ xuất hàng của user theo khu vực 0-phường, 1-tỉnh',
  })
  @Get('order/get_ship_from')
  @ApiDataResponse({ type: ShipFromAddressResponseDto, isArray: true })
  getFrom(@Query() query: GetShipFromQueryDto, @Req() req: RequestWithUser) {
    return this.ordersService.getShipFrom(query, this.getUserId(req));
  }

  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Phí ship' })
  @Post('order/get_ship_fee')
  @ApiDataResponse({ status: 201, type: ShipFeeResponseDto })
  getShipFee(@Body() query: GetShipFeeDto, @Req() req: RequestWithUser) {
    return this.ordersService.getShipFee(this.getUserId(req), query);
  }

  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Lấy danh sách tỉnh/thành phố' })
  @Get('order/provinces')
  @ApiDataResponse({ type: OrderProvinceResponseDto, isArray: true })
  getProvinces() {
    return this.ordersService.getProvinces();
  }

  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Lấy danh sách phường/xã theo tỉnh/thành phố' })
  @Get('order/wards')
  @ApiDataResponse({ type: OrderWardResponseDto, isArray: true })
  getWards(
    @Query('province_id', ParsePositiveBigIntIdPipe) provinceId: string,
  ) {
    return this.ordersService.getWardsByProvince(provinceId);
  }

  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'lấy danh sách địa chỉ của người mua' })
  @Get('order/get_list_order_address')
  @ApiDataResponse({ type: AddressResponseDto, isArray: true })
  getListOrderAddress(@Req() req: RequestWithUser) {
    return this.ordersService.getListOrderAddress(this.getUserId(req));
  }

  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Thêm địa chỉ người dùng' })
  @Post('order/add_order_address')
  @ApiDataResponse({ status: 201, type: AddressResponseDto })
  addOrderAddress(
    @Req() req: RequestWithUser,
    @Body() dto: AddOrderAddressDto,
  ) {
    return this.ordersService.addOrderAddress(this.getUserId(req), dto);
  }

  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Sửa địa chỉ người dùng' })
  @Patch('order/update/:id')
  @ApiDataResponse()
  updateOrrderAddress(
    @Req() req: RequestWithUser,
    @Body() dto: UpdateOrderAddressDto,
    @Param('id', ParsePositiveBigIntIdPipe) id: string,
  ) {
    return this.ordersService.editOrderAddress(this.getUserId(req), id, dto);
  }

  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Xóa địa chỉ người dùng' })
  @Delete('order/delete/:id')
  @ApiDataResponse()
  removeOrderAddress(
    @Param('id', ParsePositiveBigIntIdPipe) id: string,
    @Req() req: RequestWithUser,
  ) {
    return this.ordersService.delete_order_address(this.getUserId(req), id);
  }

  @UseGuards(AuthGuard)
  @Post('order/get_order_status')
  @ApiDataResponse({ status: 201, type: OrderStatusResponseDto })
  get_order_status(
    @Body() dto: GetOrderStatusDto,
    @Req() req: RequestWithUser,
  ) {
    return this.ordersService.get_order_status(this.getUserId(req), dto);
  }

  @UseGuards(AuthGuard)
  @Post('order/create_order')
  @ApiDataResponse({ status: 201, type: CheckoutOrderResponseDto })
  createOrder(@Body() body: CreateOrderDto, @Req() req: RequestWithUser) {
    return this.ordersService.createOrder(body, this.getUserId(req));
  }

  @UseGuards(AuthGuard)
  @Post('order/get_list_purchases')
  @ApiDataResponse({ status: 201, type: PurchaseListItemResponseDto, isArray: true })
  getListPurchases(
    @Body() body: GetListPurchasesDto,
    @Req() req: RequestWithUser,
  ) {
    return this.ordersService.getListPurchases(body, this.getUserId(req));
  }

  @UseGuards(AuthGuard)
  @Post('order/get_list_purchases_seller')
  @ApiDataResponse({ status: 201, type: SellerPurchaseListItemResponseDto, isArray: true })
  getListPurchasesSeller(
    @Body() body: GetListPurchasesSellerDto,
    @Req() req: RequestWithUser,
  ) {
    return this.ordersService.getListPurchasesSeller(body, this.getUserId(req));
  }

  @UseGuards(AuthGuard)
  @Post('order/get_purchase')
  @ApiDataResponse({ status: 201, type: PurchaseDetailResponseDto })
  getPurchase(@Body() body: GetPurchaseDto, @Req() req: RequestWithUser) {
    return this.ordersService.getPurchase(body, this.getUserId(req));
  }

  @UseGuards(AuthGuard)
  @Post('order/edit_purchase')
  @ApiDataResponse({ status: 201, type: EditPurchaseResponseDto })
  editPurchase(@Body() body: EditPurchaseDto, @Req() req: RequestWithUser) {
    return this.ordersService.editPurchase(body, this.getUserId(req));
  }

  @UseGuards(AuthGuard)
  @Post('order/cancel_order')
  @ApiDataResponse({ status: 201, type: CancelOrderResponseDto })
  cancelOrder(@Body() body: CancelOrderDto, @Req() req: RequestWithUser) {
    return this.ordersService.cancelOrder(body, this.getUserId(req));
  }

  @UseGuards(AuthGuard)
  @Post('order/set_accept_buyer')
  @ApiDataResponse({ status: 201 })
  setAcceptBuyer(@Body() body: SetAcceptBuyerDto, @Req() req: RequestWithUser) {
    return this.ordersService.setAcceptBuyer(body, this.getUserId(req));
  }

  @UseGuards(AuthGuard)
  @Post('order/buyer_confirm_received')
  @ApiDataResponse({ status: 201 })
  buyerConfirmReceived(
    @Body() body: BuyerConfirmReceivedDto,
    @Req() req: RequestWithUser,
  ) {
    return this.ordersService.buyerConfirmReceived(body, this.getUserId(req));
  }

  @UseGuards(AuthGuard)
  @Post('order/refund_order')
  @ApiDataResponse({ status: 201, type: RefundOrderResponseDto })
  refundOrder(@Body() body: RefundOrderDto, @Req() req: RequestWithUser) {
    return this.ordersService.refundOrder(body, this.getUserId(req));
  }

  @UseGuards(AuthGuard)
  @Post('order/respond_refund')
  @ApiDataResponse({ status: 201, type: RespondRefundResponseDto })
  respondRefund(@Body() body: RespondRefundDto, @Req() req: RequestWithUser) {
    return this.ordersService.respondRefund(body, this.getUserId(req));
  }

  @UseGuards(AuthGuard)
  @Post('order/seller_mark_as_shipped')
  @ApiDataResponse({ status: 201 })
  sellerMarkAsShipped(
    @Body() body: SellerMarkAsShippedDto,
    @Req() req: RequestWithUser,
  ) {
    return this.ordersService.sellerMarkAsShipped(body, this.getUserId(req));
  }

  @UseGuards(AuthGuard)
  @Post('order/get_order_timeline')
  @ApiDataResponse({ status: 201, type: OrderTimelineResponseDto, isArray: true })
  getOrderTimeline(
    @Body() body: GetOrderTimelineDto,
    @Req() req: RequestWithUser,
  ) {
    return this.ordersService.getOrderTimeline(body, this.getUserId(req));
  }

  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Lấy danh sách sản phẩm trong giỏ hàng' })
  @Get('order/get_cart')
  @ApiDataResponse({ type: CartShopResponseDto, isArray: true })
  getCart(@Req() req: RequestWithUser) {
    return this.ordersService.getCart(this.getUserId(req));
  }

  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Thêm sản phẩm vào giỏ hàng' })
  @Post('order/add_cart')
  @ApiDataResponse({ status: 201, type: CartMutationResponseDto })
  addCart(@Body() body: AddCartDto, @Req() req: RequestWithUser) {
    return this.ordersService.addCart(this.getUserId(req), body);
  }

  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Chỉnh sửa số lượng sản phẩm trong giỏ hàng' })
  @Post('order/edit_cart')
  @ApiDataResponse({ status: 201, type: CartMutationResponseDto })
  editCart(@Body() body: EditCartDto, @Req() req: RequestWithUser) {
    return this.ordersService.editCart(this.getUserId(req), body);
  }

  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Xóa sản phẩm khỏi giỏ hàng' })
  @Post('order/delete_cart')
  @ApiDataResponse({ status: 201 })
  deleteCart(@Body() body: DeleteCartDto, @Req() req: RequestWithUser) {
    return this.ordersService.deleteCart(this.getUserId(req), body);
  }
}
