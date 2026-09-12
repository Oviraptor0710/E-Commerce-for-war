import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LoggerMiddleware } from './common/logger.middleware';
import { UsersModule } from './modules/users/users.module';
import { dataSourceOptions } from '../data-source';
import { ProductsModule } from './modules/products/products.module';
import { newsModule } from './modules/news/news.module';
import { AuthModule } from './common/auth/auth.module';
import { RedisModule } from './common/redis/redis.module';
import { FollowModule } from './modules/follow/follow.module';
import { BlocksModule } from './modules/blocks/blocks.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { UploadModule } from './modules/upload/upload.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OrdersModule } from './modules/orders/orders.module';
import { AddressesModule } from './modules/addresses/addresses.module';
import { WalletsModule } from './modules/wallets/wallets.module';
import { DevTokensModule } from './modules/dev_tokens/dev-tokens.module';
import { PushSettingsModule } from './modules/push_settings/push-settings.module';
import { RatesModule } from './modules/rates/rates.module';
import { SearchesModule } from './modules/searches/searches.module';
import { JwtModule } from '@nestjs/jwt';
import { RewardsModule } from './modules/rewards/rewards.module';
import { SellersModule } from './modules/sellers/sellers.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      ...dataSourceOptions,
      migrations: [],
    }),
    UsersModule,
    ProductsModule,
    newsModule,
    AuthModule,
    RedisModule,
    DevTokensModule,
    FollowModule,
    BlocksModule,
    ConversationsModule,
    UploadModule,
    NotificationsModule,
    OrdersModule,
    AddressesModule,
    WalletsModule,
    PushSettingsModule,
    RatesModule,
    SearchesModule,
    RewardsModule,
    SellersModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'dev-secret'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '7d') as any,
        },
      }),
    }),
  ],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
