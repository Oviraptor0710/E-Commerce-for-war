import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryFailedError, Repository } from 'typeorm';
import {
  APP_RESPONSE,
  buildResponse,
} from '../../common/constants/response.constants';
import { ApiResponse } from '../../common/interfaces/api-response.interface';
import { User } from '../users/entities/user.entity';
import { SetUserFollowDto } from './dto/set-user-follow.dto';
import { GetListFollowedDto } from './dto/get-list-followed.dto';
import { UserFollow } from './entities/user-follow.entity';
import { UserBlock } from '../blocks/entities/user-block.entity';
import { GetListFollowingDto } from './dto/get-list-following.dto';
import { isCanonicalPositiveIntegerString } from '../../common/validation';

type SetUserFollowResponseData = {
  followee_id: string;
  is_following: boolean;
  follow_count: number;
  following_count: number;
};

@Injectable()
export class FollowService {
  constructor(
    @InjectRepository(UserFollow)
    private readonly userFollowRepository: Repository<UserFollow>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(UserBlock)
    private readonly userBlockRepository: Repository<UserBlock>,
  ) {}

  async setUserFollow(
    currentUserId: string,
    dto: SetUserFollowDto,
  ): Promise<ApiResponse<SetUserFollowResponseData | null>> {
    if (!isCanonicalPositiveIntegerString(currentUserId)) {
      return this.fail(
        APP_RESPONSE.TOKEN_INVALID.code,
        APP_RESPONSE.TOKEN_INVALID.message,
      );
    }

    if (
      dto.followee_id === undefined ||
      dto.followee_id === null ||
      dto.action === undefined ||
      dto.action === null
    ) {
      return this.fail(
        APP_RESPONSE.PARAMETER_NOT_ENOUGH.code,
        APP_RESPONSE.PARAMETER_NOT_ENOUGH.message,
      );
    }

    const followeeId = dto.followee_id;
    const action = dto.action.trim().toLowerCase();

    if (!isCanonicalPositiveIntegerString(followeeId)) {
      return this.fail(
        APP_RESPONSE.PARAMETER_VALUE_INVALID.code,
        APP_RESPONSE.PARAMETER_VALUE_INVALID.message,
      );
    }

    if (!['follow', 'unfollow'].includes(action)) {
      return this.fail(
        APP_RESPONSE.PARAMETER_VALUE_INVALID.code,
        APP_RESPONSE.PARAMETER_VALUE_INVALID.message,
      );
    }

    if (followeeId === currentUserId) {
      return this.fail(
        APP_RESPONSE.PARAMETER_VALUE_INVALID.code,
        APP_RESPONSE.PARAMETER_VALUE_INVALID.message,
      );
    }

    try {
      const currentUser = await this.userRepository.findOne({
        where: { id: currentUserId },
        select: ['id'],
      });

      if (!currentUser) {
        return this.fail(
          APP_RESPONSE.TOKEN_INVALID.code,
          APP_RESPONSE.TOKEN_INVALID.message,
        );
      }

      const followee = await this.userRepository.findOne({
        where: { id: followeeId },
        select: ['id'],
      });

      if (!followee) {
        return this.fail(
          APP_RESPONSE.USER_NOT_EXIST.code,
          APP_RESPONSE.USER_NOT_EXIST.message,
        );
      }

      const blockedRelation = await this.userBlockRepository.findOne({
        where: [
          {
            blocker_id: currentUserId,
            blocked_id: followeeId,
          },
          {
            blocker_id: followeeId,
            blocked_id: currentUserId,
          },
        ],
      });

      if (blockedRelation) {
        return this.fail(
          APP_RESPONSE.NOT_ACCESS.code,
          APP_RESPONSE.NOT_ACCESS.message,
        );
      }

      const existingFollow = await this.userFollowRepository.findOne({
        where: {
          follower_id: currentUserId,
          followee_id: followeeId,
        },
      });

      if (action === 'follow') {
        if (existingFollow) {
          return this.fail(
            APP_RESPONSE.ACTION_DONE_PREVIOUSLY.code,
            APP_RESPONSE.ACTION_DONE_PREVIOUSLY.message,
          );
        }

        const newFollow = this.userFollowRepository.create({
          follower_id: currentUserId,
          followee_id: followeeId,
        });

        await this.userFollowRepository.save(newFollow);
      }

      if (action === 'unfollow') {
        if (!existingFollow) {
          return this.fail(
            APP_RESPONSE.ACTION_DONE_PREVIOUSLY.code,
            APP_RESPONSE.ACTION_DONE_PREVIOUSLY.message,
          );
        }

        await this.userFollowRepository.delete(existingFollow.id);
      }

      const [followCount, followingCount] = await Promise.all([
        this.userFollowRepository.count({
          where: { followee_id: followeeId },
        }),
        this.userFollowRepository.count({
          where: { follower_id: currentUserId },
        }),
      ]);

      return this.ok({
        followee_id: followeeId,
        is_following: action === 'follow',
        follow_count: followCount,
        following_count: followingCount,
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        return this.fail(
          APP_RESPONSE.ACTION_DONE_PREVIOUSLY.code,
          APP_RESPONSE.ACTION_DONE_PREVIOUSLY.message,
        );
      }

      return this.fail(
        APP_RESPONSE.EXCEPTION_ERROR.code,
        APP_RESPONSE.EXCEPTION_ERROR.message,
      );
    }
  }

  async getListFollowed(
    currentUserId: string,
    dto: GetListFollowedDto,
  ): Promise<ApiResponse<any[] | null>> {
    if (!isCanonicalPositiveIntegerString(currentUserId)) {
      return this.fail(
        APP_RESPONSE.TOKEN_INVALID.code,
        APP_RESPONSE.TOKEN_INVALID.message,
      );
    }

    if (
      dto.user_id === undefined ||
      dto.user_id === null ||
      dto.index === undefined ||
      dto.index === null ||
      dto.count === undefined ||
      dto.count === null
    ) {
      return this.fail(
        APP_RESPONSE.PARAMETER_NOT_ENOUGH.code,
        APP_RESPONSE.PARAMETER_NOT_ENOUGH.message,
      );
    }

    const { user_id: userId, index, count } = dto;

    if (
      !isCanonicalPositiveIntegerString(userId) ||
      !Number.isInteger(index) ||
      !Number.isInteger(count)
    ) {
      return this.fail(
        APP_RESPONSE.PARAMETER_TYPE_INVALID.code,
        APP_RESPONSE.PARAMETER_TYPE_INVALID.message,
      );
    }

    if (index < 0 || count <= 0) {
      return this.fail(
        APP_RESPONSE.PARAMETER_VALUE_INVALID.code,
        APP_RESPONSE.PARAMETER_VALUE_INVALID.message,
      );
    }

    try {
      const targetUser = await this.userRepository.findOne({
        where: { id: userId },
        select: ['id'],
      });

      if (!targetUser) {
        return this.fail(
          APP_RESPONSE.USER_NOT_EXIST.code,
          APP_RESPONSE.USER_NOT_EXIST.message,
        );
      }

      const blockedRelation = await this.userBlockRepository.findOne({
        where: [
          {
            blocker_id: currentUserId,
            blocked_id: userId,
          },
          {
            blocker_id: userId,
            blocked_id: currentUserId,
          },
        ],
      });

      if (blockedRelation) {
        return this.fail(
          APP_RESPONSE.NOT_ACCESS.code,
          APP_RESPONSE.NOT_ACCESS.message,
        );
      }

      const followerRelations = await this.userFollowRepository.find({
        where: { followee_id: userId },
        order: { id: 'DESC' },
        skip: index,
        take: count,
      });

      if (followerRelations.length === 0) {
        return this.okList([]);
      }

      const followerIds = followerRelations.map((item) => item.follower_id);

      const followerUsers = await this.userRepository.find({
        where: { id: In(followerIds) },
        select: ['id', 'username', 'avatar'],
      });

      const currentUserFollowingRelations =
        await this.userFollowRepository.find({
          where: {
            follower_id: currentUserId,
            followee_id: In(followerIds),
          },
        });

      const followingIdSet = new Set(
        currentUserFollowingRelations.map((item) => item.followee_id),
      );

      const userMap = new Map(followerUsers.map((user) => [user.id, user]));

      const data = followerRelations
        .map((relation) => {
          const user = userMap.get(relation.follower_id);
          if (!user) return null;

          return {
            id: user.id,
            username: user.username,
            image: user.avatar,
            followed: followingIdSet.has(user.id) ? 1 : 0,
          };
        })
        .filter(Boolean);

      return this.okList(data as any[]);
    } catch {
      return this.fail(
        APP_RESPONSE.EXCEPTION_ERROR.code,
        APP_RESPONSE.EXCEPTION_ERROR.message,
      );
    }
  }

  async getListFollowing(
    currentUserId: string,
    dto: GetListFollowingDto,
  ): Promise<ApiResponse<any[] | null>> {
    if (!isCanonicalPositiveIntegerString(currentUserId)) {
      return this.fail(
        APP_RESPONSE.TOKEN_INVALID.code,
        APP_RESPONSE.TOKEN_INVALID.message,
      );
    }

    if (
      dto.user_id === undefined ||
      dto.user_id === null ||
      dto.index === undefined ||
      dto.index === null ||
      dto.count === undefined ||
      dto.count === null
    ) {
      return this.fail(
        APP_RESPONSE.PARAMETER_NOT_ENOUGH.code,
        APP_RESPONSE.PARAMETER_NOT_ENOUGH.message,
      );
    }

    const { user_id: userId, index, count } = dto;

    if (
      !isCanonicalPositiveIntegerString(userId) ||
      !Number.isInteger(index) ||
      !Number.isInteger(count)
    ) {
      return this.fail(
        APP_RESPONSE.PARAMETER_TYPE_INVALID.code,
        APP_RESPONSE.PARAMETER_TYPE_INVALID.message,
      );
    }

    if (index < 0 || count <= 0) {
      return this.fail(
        APP_RESPONSE.PARAMETER_VALUE_INVALID.code,
        APP_RESPONSE.PARAMETER_VALUE_INVALID.message,
      );
    }

    try {
      const targetUser = await this.userRepository.findOne({
        where: { id: userId },
        select: ['id'],
      });

      if (!targetUser) {
        return this.fail(
          APP_RESPONSE.USER_NOT_EXIST.code,
          APP_RESPONSE.USER_NOT_EXIST.message,
        );
      }

      const blockedRelation = await this.userBlockRepository.findOne({
        where: [
          {
            blocker_id: currentUserId,
            blocked_id: userId,
          },
          {
            blocker_id: userId,
            blocked_id: currentUserId,
          },
        ],
      });

      if (blockedRelation) {
        return this.fail(
          APP_RESPONSE.NOT_ACCESS.code,
          APP_RESPONSE.NOT_ACCESS.message,
        );
      }

      // danh sách những user mà user_id đang follow
      const followingRelations = await this.userFollowRepository.find({
        where: { follower_id: userId },
        order: { id: 'DESC' },
        skip: index,
        take: count,
      });

      if (followingRelations.length === 0) {
        return this.okList([]);
      }

      const followingIds = followingRelations.map((item) => item.followee_id);

      const followingUsers = await this.userRepository.find({
        where: { id: In(followingIds) },
        select: ['id', 'username', 'avatar'],
      });

      // current user có đang follow những người này không
      const currentUserFollowingRelations =
        await this.userFollowRepository.find({
          where: {
            follower_id: currentUserId,
            followee_id: In(followingIds),
          },
        });

      const followingIdSet = new Set(
        currentUserFollowingRelations.map((item) => item.followee_id),
      );

      const userMap = new Map(followingUsers.map((user) => [user.id, user]));

      const data = followingRelations
        .map((relation) => {
          const user = userMap.get(relation.followee_id);
          if (!user) return null;

          return {
            id: user.id,
            username: user.username,
            image: user.avatar,
            followed: followingIdSet.has(user.id) ? 1 : 0,
          };
        })
        .filter(Boolean);

      return this.okList(data as any[]);
    } catch {
      return this.fail(
        APP_RESPONSE.EXCEPTION_ERROR.code,
        APP_RESPONSE.EXCEPTION_ERROR.message,
      );
    }
  }

  private ok(
    data: SetUserFollowResponseData,
  ): ApiResponse<SetUserFollowResponseData> {
    return buildResponse(APP_RESPONSE.OK, data);
  }

  private fail(code: string, message: string): ApiResponse<null> {
    return buildResponse({ code, message }, null);
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      (error as any).driverError?.code === '23505'
    );
  }

  private okList(data: any[]): ApiResponse<any[]> {
    return buildResponse(APP_RESPONSE.OK, data);
  }
}
