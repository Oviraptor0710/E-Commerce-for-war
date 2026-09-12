import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { newsService } from './news.service';
import { GetListNewsDto } from './dto/get_list_news.dto';
import { ApiOperation } from '@nestjs/swagger';
import { ParsePositiveBigIntIdPipe } from '../../common/validation';
import { ApiDataResponse } from '../../common/swagger/api-data-response.decorator';
import { NewsListResponseDataDto, NewsResponseDto } from './dto/news-response.dto';

@Controller('News')
export class newsController {
  constructor(private readonly newsService: newsService) {}

  @ApiOperation({ summary: 'Lấy news' })
  @Get(':id')
  @ApiDataResponse({ type: NewsResponseDto })
  async getNews(@Param('id', ParsePositiveBigIntIdPipe) id: string) {
    return this.newsService.getNews(id);
  }
  @ApiOperation({ summary: 'lấy danh sách news' })
  @Post('list_news')
  @ApiDataResponse({ status: 201, type: NewsListResponseDataDto })
  async getListNews(@Body() dto: GetListNewsDto) {
    return this.newsService.getListNews(dto);
  }
}
