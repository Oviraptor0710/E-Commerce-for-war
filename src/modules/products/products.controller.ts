import {
  Body,
  Controller,
  Delete,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { ProductsService } from './products.service';
import { AuthGuard } from '../../common/auth/guards/auth.guard';
import { OptionalAuthGuard } from '../../common/auth/guards/optional-auth.guard';
import { CreateProductDto } from './dto/create_product.dto';
import { UpdateProductDto } from './dto/update_product.dto';
import { GetCommentsProductDto } from './dto/get_comments_product.dto';
import { SetCommentsProductDto } from './dto/set_comments_product.dto';
import { LikeProductDto } from './dto/like_product.dto';
import { ReportProductDto } from './dto/report_product.dto';
import { GetProductsDto } from './dto/get_products.dto';
import { GetListProductsDto } from './dto/get_list_products.dto';
import { GetListBrandsDto } from './dto/get_list_brands.dto';
import { GetCategoriesDto } from './dto/get_categories.dto';
import { SearchDto } from '../searches/dto/search.dto';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { GetUserListingsDto } from './dto/get_user_listing.dto';
import { APP_RESPONSE, buildResponse } from '../constants/response.constants';
import { ParsePositiveBigIntIdPipe } from '../../common/validation';
import { ApiDataResponse } from '../../common/swagger/api-data-response.decorator';
import {
  ProductBrandResponseDto,
  ProductCategoryResponseDto,
  ProductCommentResponseDto,
  ProductDetailResponseDto,
  ProductLikeResponseDataDto,
  ProductMutationResponseDto,
  ProductReportResponseDataDto,
  ProductSearchResponseDto,
  ProductSummaryResponseDto,
} from './dto/product-response.dto';

interface RequestWithUser extends Request {
  user: {
    id: string;
  };
}

@ApiBearerAuth('JWT-auth')
@Controller('api')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post('get_categories')
  @ApiDataResponse({ status: 201, type: ProductCategoryResponseDto, isArray: true })
  async getCategories(@Body() dto: GetCategoriesDto) {
    try {
      const data = await this.productsService.getCategories(
        dto.parent_id,
        dto.index,
        dto.count,
      );

      if (!data || data.length === 0) {
        return buildResponse(APP_RESPONSE.NO_DATA_OR_END_OF_LIST, []);
      }

      return buildResponse(APP_RESPONSE.OK, data);
    } catch (error) {
      console.error('get_categories error:', error);
      return buildResponse(APP_RESPONSE.EXCEPTION_ERROR, null);
    }
  }

  @Post('get_list_brands')
  @ApiDataResponse({ status: 201, type: ProductBrandResponseDto, isArray: true })
  async getListBrands(@Body() dto: GetListBrandsDto) {
    try {
      const data = await this.productsService.getListBrands(
        dto.category_id,
        dto.index ?? 0,
        dto.count ?? 10,
      );

      if (!data || data.length === 0) {
        return buildResponse(APP_RESPONSE.NO_DATA_OR_END_OF_LIST, []);
      }

      return buildResponse(APP_RESPONSE.OK, data);
    } catch (error) {
      console.error('get_list_brands error:', error);
      return buildResponse(APP_RESPONSE.EXCEPTION_ERROR, null);
    }
  }

  @Post('get_products')
  @ApiDataResponse({ status: 201, type: ProductDetailResponseDto })
  @UseGuards(OptionalAuthGuard)
  async getProducts(@Req() req: RequestWithUser, @Body() dto: GetProductsDto) {
    try {
      const authUserId = req.user?.id;

      const data = await this.productsService.getProductDetail(
        dto.id,
        authUserId,
      );

      if (data === APP_RESPONSE.NOT_ACCESS) {
        return buildResponse(APP_RESPONSE.NOT_ACCESS, null);
      }

      if (!data) {
        return buildResponse(APP_RESPONSE.PRODUCT_NOT_EXISTED, null);
      }

      return buildResponse(APP_RESPONSE.OK, data);
    } catch (error) {
      console.error('get_products error:', error);
      return buildResponse(APP_RESPONSE.EXCEPTION_ERROR, null);
    }
  }

  @Post('get_list_products')
  @ApiDataResponse({ status: 201, type: ProductSummaryResponseDto, isArray: true })
  @UseGuards(OptionalAuthGuard)
  async getListProducts(
    @Req() req: RequestWithUser,
    @Body() dto: GetListProductsDto,
  ) {
    try {
      const authUserId = req.user?.id;
      const data = await this.productsService.getListProducts(dto, authUserId);

      if (!data || data.length === 0) {
        return buildResponse(APP_RESPONSE.NO_DATA_OR_END_OF_LIST, []);
      }

      return buildResponse(APP_RESPONSE.OK, data);
    } catch (error) {
      console.error('get_list_products error:', error);
      return buildResponse(APP_RESPONSE.EXCEPTION_ERROR, null);
    }
  }

  @Post('get_comments_product')
  @ApiDataResponse({ status: 201, type: ProductCommentResponseDto, isArray: true })
  async getCommentsProduct(
    @Req() req: RequestWithUser,
    @Body() dto: GetCommentsProductDto,
  ) {
    try {
      const authUserId = req.user?.id;

      const product = await this.productsService.getProductById(dto.product_id);

      if (!product) {
        return buildResponse(APP_RESPONSE.PRODUCT_NOT_EXISTED, null);
      }

      if (authUserId) {
        const isBlocked = await this.productsService.isUserBlockedWithSeller(
          authUserId,
          product.seller_id,
        );

        if (isBlocked) {
          return buildResponse(APP_RESPONSE.NOT_ACCESS, null);
        }
      }

      const data = await this.productsService.getCommentsProduct(
        dto.product_id,
        dto.index,
        dto.count,
      );

      if (!data || data.length === 0) {
        return buildResponse(APP_RESPONSE.NO_DATA_OR_END_OF_LIST, []);
      }

      return buildResponse(APP_RESPONSE.OK, data);
    } catch (error) {
      console.error('get_comments_product error:', error);
      return buildResponse(APP_RESPONSE.EXCEPTION_ERROR, null);
    }
  }

  @Post('set_comments_product')
  @UseGuards(AuthGuard)
  @ApiDataResponse({ status: 201, type: ProductCommentResponseDto })
  async setCommentsProduct(
    @Req() req: RequestWithUser,
    @Body() dto: SetCommentsProductDto,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      return buildResponse(APP_RESPONSE.TOKEN_INVALID, null);
    }

    const data = await this.productsService.setCommentsProduct(
      dto.product_id,
      userId,
      dto.content,
      dto.media_ids ?? [],
      dto.idempotency_key,
    );

    return buildResponse(APP_RESPONSE.OK, data);
  }

  @Post('like_product')
  @UseGuards(AuthGuard)
  @ApiDataResponse({ status: 201, type: ProductLikeResponseDataDto })
  async likeProduct(@Req() req: RequestWithUser, @Body() dto: LikeProductDto) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return buildResponse(APP_RESPONSE.TOKEN_INVALID, null);
      }

      const product = await this.productsService.getProductById(dto.product_id);

      if (!product) {
        return buildResponse(APP_RESPONSE.PRODUCT_NOT_EXISTED, null);
      }

      const user = await this.productsService.getUserById(userId);

      if (!user) {
        return buildResponse(APP_RESPONSE.USER_NOT_EXIST, null);
      }

      const isBlocked = await this.productsService.isUserBlockedWithSeller(
        userId,
        product.seller_id,
      );

      if (isBlocked) {
        return buildResponse(APP_RESPONSE.NOT_ACCESS, null);
      }

      const data = await this.productsService.likeProduct(
        dto.product_id,
        userId,
      );

      return buildResponse(APP_RESPONSE.OK, data);
    } catch (error) {
      console.error('like_product error:', error);
      return buildResponse(APP_RESPONSE.EXCEPTION_ERROR, null);
    }
  }

  @Post('report_product')
  @UseGuards(AuthGuard)
  @ApiDataResponse({ status: 201, type: ProductReportResponseDataDto })
  async reportProduct(
    @Req() req: RequestWithUser,
    @Body() dto: ReportProductDto,
  ) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return buildResponse(APP_RESPONSE.TOKEN_INVALID, null);
      }

      const product = await this.productsService.getProductById(dto.product_id);

      if (!product) {
        return buildResponse(APP_RESPONSE.PRODUCT_NOT_EXISTED, null);
      }

      const user = await this.productsService.getUserById(userId);

      if (!user) {
        return buildResponse(APP_RESPONSE.USER_NOT_EXIST, null);
      }

      const isBlocked = await this.productsService.isUserBlockedWithSeller(
        userId,
        product.seller_id,
      );

      if (isBlocked) {
        return buildResponse(APP_RESPONSE.NOT_ACCESS, null);
      }

      const data = await this.productsService.reportProduct(
        dto.product_id,
        userId,
        dto.subject,
        dto.details,
      );

      if (data === APP_RESPONSE.ACTION_DONE_PREVIOUSLY) {
        return buildResponse(APP_RESPONSE.ACTION_DONE_PREVIOUSLY, null);
      }

      return buildResponse(APP_RESPONSE.OK, data);
    } catch (error) {
      console.error('report_product error:', error);
      return buildResponse(APP_RESPONSE.EXCEPTION_ERROR, null);
    }
  }

  @Post('search')
  @ApiDataResponse({ status: 201, type: ProductSearchResponseDto, isArray: true })
  async search(@Body() dto: SearchDto) {
    try {
      const hasCondition =
        (dto.keyword !== undefined && dto.keyword !== '') ||
        dto.category_id !== undefined ||
        dto.brand_id !== undefined ||
        dto.price_min !== undefined ||
        dto.price_max !== undefined;

      if (!hasCondition) {
        return buildResponse(APP_RESPONSE.PARAMETER_NOT_ENOUGH, null);
      }

      const data = await this.productsService.searchProducts(
        dto.keyword,
        dto.category_id,
        dto.brand_id,
        dto.price_min,
        dto.price_max,
        dto.index,
        dto.count,
      );

      if (!data || data.length === 0) {
        return buildResponse(APP_RESPONSE.NO_DATA_OR_END_OF_LIST, []);
      }

      return buildResponse(APP_RESPONSE.OK, data);
    } catch (error) {
      console.error('search error:', error);
      return buildResponse(APP_RESPONSE.EXCEPTION_ERROR, null);
    }
  }

  @ApiOperation({
    summary: 'Người bán thêm sản phẩm',
  })
  @UseGuards(AuthGuard)
  @Post('add_product')
  @ApiDataResponse({ status: 201, type: ProductMutationResponseDto })
  async create(
    @Body() dto: CreateProductDto,
    @Req() req: RequestWithUser,
  ): Promise<any> {
    return this.productsService.createProduct(dto, req.user?.id);
  }

  @ApiOperation({
    summary: 'Người bán cập nhật thông tin sản phẩm',
  })
  @UseGuards(AuthGuard)
  @Patch('update/:id')
  @ApiDataResponse({ type: ProductMutationResponseDto })
  async update(
    @Param('id', ParsePositiveBigIntIdPipe) id: string,
    @Req() req: RequestWithUser,
    @Body() updateProductDto: UpdateProductDto,
  ): Promise<any> {
    return this.productsService.update(req.user?.id, id, updateProductDto);
  }

  @ApiOperation({
    summary: 'Người bán xóa sản phầm',
  })
  @UseGuards(AuthGuard)
  @Delete('delete/:id')
  @ApiDataResponse()
  async remove(
    @Param('id', ParsePositiveBigIntIdPipe) id: string,
    @Req() req: RequestWithUser,
  ) {
    return this.productsService.remove(id, req.user?.id);
  }

  @ApiOperation({
    summary: 'Lấy danh sách sản phẩm của người bán',
  })
  @UseGuards(AuthGuard)
  @Post('get_user_listings')
  @ApiDataResponse({ status: 201, type: ProductSummaryResponseDto, isArray: true })
  async getUserListings(
    @Req() req: RequestWithUser,
    @Body() query: GetUserListingsDto,
  ) {
    return this.productsService.get_listing(req.user?.id, query);
  }
}
