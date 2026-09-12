// src/modules/products/products-search.service.ts
import { Injectable } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { ConfigService } from '@nestjs/config';
import { Product } from './entities/product.entity';

@Injectable()
export class ProductsSearchService {
  private readonly indexName: string;

  constructor(
    private readonly elasticsearchService: ElasticsearchService,
    private readonly configService: ConfigService,
  ) {
    this.indexName =
      this.configService.get<string>('ELASTICSEARCH_INDEX') || 'products';
  }

  // Tạo index và định nghĩa mapping (nếu chưa tồn tại)
  async createIndex() {
    const checkIndex = await this.elasticsearchService.indices.exists({
      index: this.indexName,
    });

    if (!checkIndex) {
      await this.elasticsearchService.indices.create({
        index: this.indexName,
        settings: {
          analysis: {
            analyzer: {
              vietnamese_analyzer: {
                type: 'custom',
                tokenizer: 'standard',
                filter: ['lowercase', 'asciifolding'], // asciifolding giúp tìm kiếm không dấu (ví dụ: 'áo' khớp với 'ao')
              },
            },
          },
        },
        mappings: {
          properties: {
            id: { type: 'keyword' },
            title: {
              type: 'text',
              analyzer: 'vietnamese_analyzer',
              search_analyzer: 'vietnamese_analyzer',
            },
            description: {
              type: 'text',
              analyzer: 'vietnamese_analyzer',
            },
            min_price: { type: 'double' },
            max_price: { type: 'double' },
            category_id: { type: 'keyword' },
            brand_id: { type: 'keyword' },
            created_at: { type: 'date' },
          },
        },
      });
    }
  }

  // Index (Lưu hoặc Cập nhật) một sản phẩm lên ES
  async indexProduct(product: Product) {
    return this.elasticsearchService.index({
      index: this.indexName,
      id: product.id.toString(),
      document: {
        id: product.id,
        title: product.title,
        description: product.description,
        min_price: product.min_price,
        max_price: product.max_price,
        category_id: product.category_id,
        brand_id: product.brand_id,
        created_at: product.created_at,
      },
    });
  }

  // Xóa sản phẩm khỏi index
  async removeProduct(productId: string) {
    try {
      await this.elasticsearchService.delete({
        index: this.indexName,
        id: productId.toString(),
      });
    } catch (error) {
      // Trường hợp id chưa được index mà bị xóa
      console.warn(
        `Product ID ${productId} not found in Elasticsearch during deletion`,
      );
    }
  }

  // Tìm kiếm theo keyword và bộ lọc
  async search(
    keyword: string,
    categoryId?: string,
    brandId?: string,
    priceMin?: number,
    priceMax?: number,
    index: number = 0,
    count: number = 10,
  ) {
    const mustQueries: any[] = [];
    const filterQueries: any[] = [];

    // Tìm kiếm tương đối full-text trên title và description
    if (keyword && keyword.trim() !== '') {
      mustQueries.push({
        multi_match: {
          query: keyword,
          fields: ['title^3', 'description^1'], // title có trọng số x3 độ ưu tiên
          fuzziness: 'AUTO', // Hỗ trợ gõ sai lỗi chính tả nhẹ
          operator: 'or',
        },
      });
    } else {
      mustQueries.push({ match_all: {} });
    }

    // Các bộ lọc bổ sung
    if (categoryId !== undefined) {
      filterQueries.push({ term: { category_id: categoryId } });
    }
    if (brandId !== undefined) {
      filterQueries.push({ term: { brand_id: brandId } });
    }
    if (priceMin !== undefined || priceMax !== undefined) {
      if (priceMin !== undefined) {
        filterQueries.push({ range: { max_price: { gte: priceMin } } });
      }
      if (priceMax !== undefined) {
        filterQueries.push({ range: { min_price: { lte: priceMax } } });
      }
    }

    const result = await this.elasticsearchService.search<any>({
      index: this.indexName,
      from: index,
      size: count,
      query: {
        bool: {
          must: mustQueries,
          filter: filterQueries,
        },
      },
      sort: [
        { _score: { order: 'desc' } }, // Sắp xếp theo mức độ khớp trước
        { id: { order: 'desc' } }, // fallback ID mới nhất
      ],
    });

    const hits = result.hits.hits;
    return hits.map((item) => item._source.id as string);
  }
}
