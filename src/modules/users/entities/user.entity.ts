import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { UserRole } from '../enums/user-role.enum';
import { UserCode } from './user_code.entity';
import { Wallet } from '../../wallets/entities/wallet.entity';
import { RewardProof } from '../../rewards/entities/reward_proof.entity';
import { RewardAppeal } from '../../rewards/entities/reward_appeal.entity';
import { Comment } from '../../products/entities/comment.entity';
import { Like } from '../../products/entities/like.entity';
import { Report } from '../../products/entities/report.entity';
import { Order } from '../../orders/entities/order.entity';
import { Message } from '../../conversations/entities/message.entity';
import { UserFollow } from '../../follow/entities/user-follow.entity';
import { ConversationParticipant } from '../../conversations/entities/conversation-participant.entity';
import { Notification } from '../../notifications/entities/notification.entity';
import { Address } from '../../orders/entities/address.entity';
import { CartItem } from '../../orders/entities/cart-item.entity';
import { SellerApplication } from '../../sellers/entities/seller-application.entity';
import { SellerProfile } from '../../sellers/entities/seller-profile.entity';

@Entity('users')
@Index('UQ_users_username', ['username'], { unique: true })
@Index('UQ_users_email', ['email'], { unique: true })
@Index('UQ_users_phonenumber', ['phone_number'], { unique: true })
@Index('UQ_users_uuid', ['uuid'], { unique: true })
export class User {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ nullable: false })
  username: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ name: 'phonenumber', length: 30, nullable: false })
  phone_number: string;

  @Column({ select: false })
  password: string;

  @Column({ nullable: false })
  uuid: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @Column({ name: 'fullName', nullable: true })
  fullname: string;

  @Column({ name: 'firstName', nullable: true })
  firstname: string;

  @Column({ name: 'lastName', nullable: true })
  lastname: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: false, default: 'active' })
  status: string;

  @Column({ nullable: true })
  cover_image: string;

  @Column({ nullable: true })
  cover_image_web: string;

  @Column({ nullable: true })
  avatar: string;

  @Column('text', { nullable: true })
  bio: string;

  @CreateDateColumn()
  created_at: Date;

  @OneToOne(() => Wallet, (wallet) => wallet.user)
  wallet: Wallet;

  @OneToMany(() => UserCode, (userCode) => userCode.user)
  user_codes: UserCode[];

  @OneToMany(() => RewardProof, (proof) => proof.user)
  reward_proofs: RewardProof[];

  @OneToMany(() => RewardAppeal, (appeal) => appeal.user)
  appeals: RewardAppeal[];

  @OneToMany(() => Comment, (comment) => comment.user)
  comments: Comment[];

  @OneToMany(() => Like, (like) => like.user)
  likes: Like[];

  @OneToMany(() => Report, (report) => report.user)
  reports: Report[];

  @OneToMany(() => Order, (order) => order.buyer)
  orders_bought: Order[];

  @OneToMany(() => ConversationParticipant, (participant) => participant.user)
  conversation_participations: ConversationParticipant[];

  @OneToMany(() => Message, (message) => message.sender)
  messages_sent: Message[];

  @OneToMany(() => Notification, (notification) => notification.user)
  notifications: Notification[];

  @OneToMany(() => UserFollow, (follow) => follow.follower)
  following_relations: UserFollow[];

  @OneToMany(() => UserFollow, (follow) => follow.followee)
  follower_relations: UserFollow[];

  @OneToMany(() => Address, (address) => address.user)
  addresses: Address[];

  @OneToMany(() => CartItem, (cartItem) => cartItem.user)
  cart_items: CartItem[];

  @OneToMany(() => SellerApplication, (application) => application.applicant)
  seller_applications: SellerApplication[];

  @OneToMany(() => SellerApplication, (application) => application.reviewer)
  reviewed_seller_applications: SellerApplication[];

  @OneToOne(() => SellerProfile, (profile) => profile.user)
  seller_profile: SellerProfile | null;
}
