import { DataSource, DataSourceOptions } from 'typeorm';
import { config } from 'dotenv';
import { SecretConfig } from './src/config/secret';

config();

import { User } from './src/modules/users/entities/user.entity';
import { UserCode } from './src/modules/users/entities/user_code.entity';
import { Wallet } from './src/modules/wallets/entities/wallet.entity';
import { Transaction } from './src/modules/wallets/entities/transaction.entity';
import { WalletOperation } from './src/modules/wallets/entities/wallet-operation.entity';
import { WalletEntry } from './src/modules/wallets/entities/wallet-entry.entity';
import { RewardRule } from './src/modules/rewards/entities/reward_rule.entity';
import { RewardProof } from './src/modules/rewards/entities/reward_proof.entity';
import { RewardAppeal } from './src/modules/rewards/entities/reward_appeal.entity';
import { ProofAchievement } from './src/modules/rewards/entities/proof_achievement.entity';
import { AiEvaluationLog } from './src/modules/rewards/entities/ai_evaluation_log.entity';
import { Product } from './src/modules/products/entities/product.entity';
import { Like } from './src/modules/products/entities/like.entity';
import { Comment } from './src/modules/products/entities/comment.entity';
import { Report } from './src/modules/products/entities/report.entity';
import { ProductVariant } from './src/modules/products/entities/product_variant.entity';
import { Order } from './src/modules/orders/entities/order.entity';
import { OrderItem } from './src/modules/orders/entities/order_item.entity';
import { Shipping } from './src/modules/orders/entities/shipping.entity';
import { OrderTimeline } from './src/modules/orders/entities/order-timeline.entity';
import { Refund } from './src/modules/orders/entities/refund.entity';
import { Conversation } from './src/modules/conversations/entities/conversation.entity';
import { Message } from './src/modules/conversations/entities/message.entity';
import { ConversationParticipant } from './src/modules/conversations/entities/conversation-participant.entity';
import { Address } from './src/modules/orders/entities/address.entity';
import { News } from './src/modules/news/entities/news.entity';
import { Ward } from './src/modules/orders/entities/ward.entity';
import { Province } from './src/modules/orders/entities/province.entity';
import { Brand } from './src/modules/products/entities/brand.entity';
import { Category } from './src/modules/products/entities/category.entity';
import { DevToken } from './src/modules/dev_tokens/entities/dev-token.entity';
import { UserFollow } from './src/modules/follow/entities/user-follow.entity';
import { UserBlock } from './src/modules/blocks/entities/user-block.entity';
import { Notification } from './src/modules/notifications/entities/notification.entity';
import { PushSetting } from './src/modules/push_settings/entities/push-setting.entity';
import { Rate } from './src/modules/rates/entities/rate.entity';
import { SavedSearch } from './src/modules/searches/entities/saved_search.entity';
import { CartItem } from './src/modules/orders/entities/cart-item.entity';
import { SellerApplication } from './src/modules/sellers/entities/seller-application.entity';
import { SellerProfile } from './src/modules/sellers/entities/seller-profile.entity';
import { InventoryMovement } from './src/modules/inventory/entities/inventory-movement.entity';
import { MediaAsset } from './src/modules/upload/entities/media-asset.entity';
import { CommentMedia } from './src/modules/products/entities/comment-media.entity';

export const dataSourceOptions: DataSourceOptions = {
  type: 'mysql',
  host: SecretConfig.database.host,
  port: SecretConfig.database.port,
  username: SecretConfig.database.username,
  password: SecretConfig.database.password,
  database: SecretConfig.database.name,
  entities: [
    User,
    UserCode,
    Wallet,
    Transaction,
    WalletOperation,
    WalletEntry,
    RewardProof,
    RewardAppeal,
    ProofAchievement,
    AiEvaluationLog,
    RewardRule,
    Product,
    Like,
    Comment,
    Report,
    ProductVariant,
    Order,
    OrderItem,
    Shipping,
    OrderTimeline,
    Refund,
    Address,
    News,
    Conversation,
    ConversationParticipant,
    Message,
    Ward,
    Province,
    Brand,
    Category,
    DevToken,
    UserBlock,
    UserFollow,
    PushSetting,
    Rate,
    SavedSearch,
    Notification,
    CartItem,
    SellerApplication,
    SellerProfile,
    InventoryMovement,
    MediaAsset,
    CommentMedia,
  ],
  migrations: ['src/migrations/*.ts'],
  synchronize: process.env.NODE_ENV === 'test' ? true : false,
};

const dataSource = new DataSource(dataSourceOptions);

export default dataSource;
