import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { SearchesService } from './searches.service';
import { ProductsService } from '../products/products.service';
import { AuthGuard } from '../../common/auth/guards/auth.guard';
import {
  APP_RESPONSE,
  buildResponse,
} from '../constants/response.constants';
import { SaveSearchDto } from './dto/save_search.dto';
import { GetListSavedSearchDto } from './dto/get_list_saved_search.dto';
import { SearchDto } from './dto/search.dto';
import { DelSavedSearchDto } from './dto/del_saved_search.dto';
import { ApiDataResponse } from '../../common/swagger/api-data-response.decorator';
import { SavedSearchResponseDto } from './dto/saved-search-response.dto';
import { ProductSearchResponseDto } from '../products/dto/product-response.dto';

interface RequestWithUser extends Request {
  user: {
    id?: string;
    userId?: string;
  };
}

@Controller('api')
export class SearchesController {
  constructor(
    private readonly searchesService: SearchesService,
    private readonly productsService: ProductsService,
  ) {}

  @Post('save_search')
  @UseGuards(AuthGuard)
  @ApiDataResponse({ status: 201, type: SavedSearchResponseDto })
  async saveSearch(
    @Req() req: RequestWithUser,
    @Body() dto: SaveSearchDto,
  ) {
    try {
      const userId = req.user?.userId ?? req.user?.id;

      if (!userId) {
        return buildResponse(APP_RESPONSE.TOKEN_INVALID, null);
      }

      const data = await this.searchesService.saveSearch(userId, dto.keyword);

      return buildResponse(APP_RESPONSE.OK, data);
    } catch (error) {
      console.error('save_search error:', error);
      return buildResponse(APP_RESPONSE.EXCEPTION_ERROR, null);
    }
  }

  @Post('get_list_saved_search')
  @UseGuards(AuthGuard)
  @ApiDataResponse({ status: 201, type: SavedSearchResponseDto, isArray: true })
  async getListSavedSearch(
    @Req() req: RequestWithUser,
    @Body() dto: GetListSavedSearchDto,
  ) {
    try {
      const userId = req.user?.userId ?? req.user?.id;

      if (!userId) {
        return buildResponse(APP_RESPONSE.TOKEN_INVALID, null);
      }

      const data = await this.searchesService.getListSavedSearch(
        userId,
        dto.index,
        dto.count,
      );

      if (!data || data.length === 0) {
        return buildResponse(APP_RESPONSE.NO_DATA_OR_END_OF_LIST, []);
      }

      return buildResponse(APP_RESPONSE.OK, data);
    } catch (error) {
      console.error('get_list_saved_search error:', error);
      return buildResponse(APP_RESPONSE.EXCEPTION_ERROR, null);
    }
  }

  @Post('search')
  @UseGuards(AuthGuard)
  @ApiDataResponse({ status: 201, type: ProductSearchResponseDto, isArray: true })
  async search(
    @Req() req: RequestWithUser,
    @Body() dto: SearchDto,
  ) {
    try {
      const userId = req.user?.userId ?? req.user?.id;

      if (!userId) {
        return buildResponse(APP_RESPONSE.TOKEN_INVALID, null);
      }

      const hasCondition =
        (dto.keyword !== undefined && dto.keyword.trim() !== '') ||
        dto.category_id !== undefined ||
        dto.brand_id !== undefined ||
        dto.price_min !== undefined ||
        dto.price_max !== undefined;

      if (!hasCondition) {
        return buildResponse(APP_RESPONSE.PARAMETER_NOT_ENOUGH, null);
      }

      if (dto.keyword !== undefined && dto.keyword.trim() !== '') {
        await this.searchesService.saveSearch(userId, dto.keyword);
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

  @Post('del_saved_search')
  @UseGuards(AuthGuard)
  @ApiDataResponse({ status: 201 })
  async delSavedSearch(
    @Req() req: RequestWithUser,
    @Body() dto: DelSavedSearchDto,
  ) {
    try {
      const userId = req.user?.userId ?? req.user?.id;

      if (!userId) {
        return buildResponse(APP_RESPONSE.TOKEN_INVALID, null);
      }

      if (
        (dto.search_id === undefined || dto.search_id === null) &&
        (dto.keyword === undefined || dto.keyword === '')
      ) {
        return buildResponse(APP_RESPONSE.PARAMETER_NOT_ENOUGH, null);
      }

      const deleted = await this.searchesService.delSavedSearch(
        userId,
        dto.search_id,
        dto.keyword,
      );

      if (!deleted) {
        return buildResponse(APP_RESPONSE.NO_DATA_OR_END_OF_LIST, null);
      }

      return buildResponse(APP_RESPONSE.OK, null);
    } catch (error) {
      console.error('del_saved_search error:', error);
      return buildResponse(APP_RESPONSE.EXCEPTION_ERROR, null);
    }
  }
}
