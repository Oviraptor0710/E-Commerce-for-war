import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import {
  APP_RESPONSE,
  buildResponse,
} from '../../common/constants/response.constants';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { Address } from '../orders/entities/address.entity';
import { CreateSellerApplicationDto } from './dto/create-seller-application.dto';
import { ListSellerApplicationsDto } from './dto/list-seller-applications.dto';
import { SellerApplication } from './entities/seller-application.entity';
import { SellerProfile } from './entities/seller-profile.entity';
import { SellerApplicationStatus } from './enums/seller-application-status.enum';
import { SellerProfileStatus } from './enums/seller-profile-status.enum';
import { isCanonicalPositiveIntegerString } from '../../common/validation';

@Injectable()
export class SellersService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(SellerApplication)
    private readonly applicationRepository: Repository<SellerApplication>,
    @InjectRepository(SellerProfile)
    private readonly profileRepository: Repository<SellerProfile>,
  ) {}

  async submitApplication(userId: string, dto: CreateSellerApplicationDto) {
    if (!userId) return buildResponse(APP_RESPONSE.TOKEN_INVALID, null);

    const shopName = dto.shop_name.trim();
    const description = dto.description?.trim() || null;

    if (!shopName) {
      return buildResponse(APP_RESPONSE.PARAMETER_NOT_ENOUGH, null);
    }

    return this.dataSource.transaction(async (manager) => {
      const user = await this.lockUser(manager, userId);
      if (!user || user.status !== 'active') {
        return buildResponse(APP_RESPONSE.NOT_ACCESS, null);
      }

      const existingProfile = await manager.findOne(SellerProfile, {
        where: { user_id: userId },
      });
      if (existingProfile) {
        return buildResponse(APP_RESPONSE.ACTION_DONE_PREVIOUSLY, null);
      }

      const pendingApplication = await manager.findOne(SellerApplication, {
        where: {
          applicant_id: userId,
          status: SellerApplicationStatus.PENDING,
        },
      });
      if (pendingApplication) {
        return buildResponse(APP_RESPONSE.ACTION_DONE_PREVIOUSLY, {
          application_id: pendingApplication.id,
          status: pendingApplication.status,
        });
      }

      const address = await manager.findOne(Address, {
        where: {
          id: dto.ship_from_address_id,
          user_id: userId,
          deleted_at: IsNull(),
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (!address) {
        return buildResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID, null);
      }

      const now = new Date();
      const application = manager.create(SellerApplication, {
        applicant_id: userId,
        shop_name: shopName,
        description,
        ship_from_address_id: address.id,
        ship_from_full_address_snapshot: address.full_address,
        status: SellerApplicationStatus.PENDING,
        reviewed_by: null,
        reviewed_at: null,
        rejection_reason: null,
        submitted_at: now,
        created_at: now,
        updated_at: now,
      });

      const saved = await manager.save(SellerApplication, application);
      return buildResponse(APP_RESPONSE.OK, saved);
    });
  }

  async getMyApplications(userId: string, query: ListSellerApplicationsDto) {
    if (!userId) return buildResponse(APP_RESPONSE.TOKEN_INVALID, null);

    const index = query.index ?? 0;
    const count = query.count ?? 20;
    const [applications, total] = await this.applicationRepository.findAndCount(
      {
        where: {
          applicant_id: userId,
          ...(query.status ? { status: query.status } : {}),
        },
        relations: { reviewer: true },
        order: { created_at: 'DESC', id: 'DESC' },
        skip: index * count,
        take: count,
      },
    );

    return buildResponse(APP_RESPONSE.OK, { applications, total });
  }

  async getMyProfile(userId: string) {
    if (!userId) return buildResponse(APP_RESPONSE.TOKEN_INVALID, null);

    const profile = await this.profileRepository.findOne({
      where: { user_id: userId },
      relations: { default_ship_from_address: true },
    });

    return profile
      ? buildResponse(APP_RESPONSE.OK, profile)
      : buildResponse(APP_RESPONSE.NO_DATA_OR_END_OF_LIST, null);
  }

  async listApplications(query: ListSellerApplicationsDto) {
    const index = query.index ?? 0;
    const count = query.count ?? 20;
    const [applications, total] = await this.applicationRepository.findAndCount(
      {
        where: query.status ? { status: query.status } : {},
        relations: {
          applicant: true,
          reviewer: true,
          ship_from_address: true,
        },
        order: { submitted_at: 'ASC', id: 'ASC' },
        skip: index * count,
        take: count,
      },
    );

    return buildResponse(APP_RESPONSE.OK, { applications, total });
  }

  async approveApplication(applicationId: string, adminId: string) {
    if (!this.isPositiveBigInt(applicationId)) {
      return buildResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID, null);
    }

    const applicationPreview = await this.applicationRepository.findOne({
      where: { id: applicationId },
      select: { id: true, applicant_id: true },
    });
    if (!applicationPreview) {
      return buildResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID, null);
    }

    return this.dataSource.transaction(async (manager) => {
      const admin = await manager.findOne(User, { where: { id: adminId } });
      if (
        !admin ||
        admin.role !== UserRole.ADMIN ||
        admin.status !== 'active'
      ) {
        return buildResponse(APP_RESPONSE.NOT_ACCESS, null);
      }

      const applicant = await this.lockUser(
        manager,
        applicationPreview.applicant_id,
      );
      if (!applicant || applicant.status !== 'active') {
        return buildResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID, null);
      }

      const application = await manager.findOne(SellerApplication, {
        where: { id: applicationId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!application) {
        return buildResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID, null);
      }
      if (application.status !== SellerApplicationStatus.PENDING) {
        return buildResponse(APP_RESPONSE.ACTION_DONE_PREVIOUSLY, {
          application_id: application.id,
          status: application.status,
        });
      }

      const address = await manager.findOne(Address, {
        where: {
          id: application.ship_from_address_id,
          user_id: application.applicant_id,
          deleted_at: IsNull(),
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (!address) {
        return buildResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID, null);
      }

      const existingProfile = await manager.findOne(SellerProfile, {
        where: { user_id: application.applicant_id },
      });
      if (existingProfile) {
        return buildResponse(APP_RESPONSE.ACTION_DONE_PREVIOUSLY, {
          user_id: existingProfile.user_id,
          status: existingProfile.status,
        });
      }

      const now = new Date();
      application.status = SellerApplicationStatus.APPROVED;
      application.reviewed_by = adminId;
      application.reviewed_at = now;
      application.rejection_reason = null;
      application.updated_at = now;
      await manager.save(SellerApplication, application);

      const profile = manager.create(SellerProfile, {
        user_id: application.applicant_id,
        approved_application_id: application.id,
        shop_name: application.shop_name,
        description: application.description,
        default_ship_from_address_id: address.id,
        status: SellerProfileStatus.ACTIVE,
        approved_at: now,
        created_at: now,
        updated_at: now,
      });
      const savedProfile = await manager.save(SellerProfile, profile);

      return buildResponse(APP_RESPONSE.OK, {
        application_id: application.id,
        profile: savedProfile,
      });
    });
  }

  async rejectApplication(
    applicationId: string,
    adminId: string,
    reason: string,
  ) {
    if (!this.isPositiveBigInt(applicationId) || !reason?.trim()) {
      return buildResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID, null);
    }

    const applicationPreview = await this.applicationRepository.findOne({
      where: { id: applicationId },
      select: { id: true, applicant_id: true },
    });
    if (!applicationPreview) {
      return buildResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID, null);
    }

    return this.dataSource.transaction(async (manager) => {
      const admin = await manager.findOne(User, { where: { id: adminId } });
      if (
        !admin ||
        admin.role !== UserRole.ADMIN ||
        admin.status !== 'active'
      ) {
        return buildResponse(APP_RESPONSE.NOT_ACCESS, null);
      }

      await this.lockUser(manager, applicationPreview.applicant_id);
      const application = await manager.findOne(SellerApplication, {
        where: { id: applicationId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!application) {
        return buildResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID, null);
      }
      if (application.status !== SellerApplicationStatus.PENDING) {
        return buildResponse(APP_RESPONSE.ACTION_DONE_PREVIOUSLY, {
          application_id: application.id,
          status: application.status,
        });
      }

      const now = new Date();
      application.status = SellerApplicationStatus.REJECTED;
      application.reviewed_by = adminId;
      application.reviewed_at = now;
      application.rejection_reason = reason.trim();
      application.updated_at = now;
      const saved = await manager.save(SellerApplication, application);

      return buildResponse(APP_RESPONSE.OK, saved);
    });
  }

  async updateProfileStatus(
    sellerUserId: string,
    adminId: string,
    status: SellerProfileStatus,
  ) {
    if (!isCanonicalPositiveIntegerString(sellerUserId)) {
      return buildResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID, null);
    }

    return this.dataSource.transaction(async (manager) => {
      const admin = await manager.findOne(User, { where: { id: adminId } });
      if (
        !admin ||
        admin.role !== UserRole.ADMIN ||
        admin.status !== 'active'
      ) {
        return buildResponse(APP_RESPONSE.NOT_ACCESS, null);
      }

      const seller = await this.lockUser(manager, sellerUserId);
      if (!seller) {
        return buildResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID, null);
      }

      const profile = await manager.findOne(SellerProfile, {
        where: { user_id: sellerUserId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!profile) {
        return buildResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID, null);
      }
      if (profile.status === status) {
        return buildResponse(APP_RESPONSE.ACTION_DONE_PREVIOUSLY, {
          user_id: profile.user_id,
          status: profile.status,
        });
      }

      profile.status = status;
      profile.updated_at = new Date();
      const saved = await manager.save(SellerProfile, profile);
      return buildResponse(APP_RESPONSE.OK, saved);
    });
  }

  private lockUser(manager: EntityManager, userId: string) {
    return manager
      .getRepository(User)
      .createQueryBuilder('user')
      .where('user.id = :userId', { userId })
      .setLock('pessimistic_write')
      .getOne();
  }

  private isPositiveBigInt(value: string) {
    return /^[1-9]\d*$/.test(value);
  }
}
