import { News } from './entities/news.entity';
import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { GetListNewsDto } from './dto/get_list_news.dto';
import { APP_RESPONSE, buildResponse } from '../constants/response.constants';
@Injectable()
export class newsService {
  constructor(
    @InjectRepository(News)
    private newsRepo: Repository<News>,
  ) {}
  async getNews(id: string) {
    const news = await this.newsRepo.findOne({
      where: { id },
    });
    if (!news) {
      return APP_RESPONSE.PARAMETER_VALUE_INVALID;
    }
    return buildResponse(APP_RESPONSE.OK, news);
  }
  async getListNews(query: GetListNewsDto) {
    const { index, count } = query;
    if (index === undefined && count === undefined) {
      const [list_news, total] = await this.newsRepo.findAndCount({
        order: { id: 'DESC' },
      });
      return buildResponse(APP_RESPONSE.OK, { list_news, total });
    }
    if (index === undefined || count === undefined)
      return APP_RESPONSE.PARAMETER_NOT_ENOUGH;
    if (!Number.isInteger(index) || !Number.isInteger(count))
      return APP_RESPONSE.PARAMETER_TYPE_INVALID;
    if (index < 0 || count <= 0) return APP_RESPONSE.PARAMETER_VALUE_INVALID;
    const [news, total] = await this.newsRepo.findAndCount({
      skip: index * count,
      take: count,
      order: { id: 'DESC' },
    });
    return buildResponse(APP_RESPONSE.OK, {
      list_news: news,
      total,
    });
  }
}
