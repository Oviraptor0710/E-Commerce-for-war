import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { Product } from './entities/product.entity';
import { Like } from './entities/like.entity';
import { Comment } from './entities/comment.entity';
import { User } from '../users/entities/user.entity';
import { Report } from './entities/report.entity';
import { ProductVariant } from './entities/product_variant.entity';
import { Brand } from './entities/brand.entity';
import { Category } from './entities/category.entity';
import { Address } from '../orders/entities/address.entity';
import { UserBlock } from '../blocks/entities/user-block.entity';
import { DevToken } from '../dev_tokens/entities/dev-token.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { ProductsSearchService } from './products-search.service';
import { SellerProfile } from '../sellers/entities/seller-profile.entity';
import { CommentMedia } from './entities/comment-media.entity';
import { MediaAsset } from '../upload/entities/media-asset.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order_item.entity';
import { UploadModule } from '../upload/upload.module';
import { ProductCommentsService } from './product-comments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      Comment,
      User,
      Like,
      Report,
      ProductVariant,
      UserBlock,
      Brand,
      Category,
      Address,
      DevToken,
      SellerProfile,
      CommentMedia,
      MediaAsset,
      Order,
      OrderItem,
    ]),
    NotificationsModule,
    UploadModule,
    ConfigModule,
    ElasticsearchModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const node = configService.get<string>('ELASTICSEARCH_NODE');
        const username = configService.get<string>('ELASTICSEARCH_USERNAME');
        const password = configService.get<string>('ELASTICSEARCH_PASSWORD');
        const config: any = {
          node: node || 'http://localhost:9201',
        };
        if (username && password) {
          config.auth = {
            username,
            password,
          };
        }
        return config;
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [ProductsController],
  providers: [ProductsService, ProductsSearchService, ProductCommentsService],
  exports: [ProductsService, ProductsSearchService],
})
export class ProductsModule {}
