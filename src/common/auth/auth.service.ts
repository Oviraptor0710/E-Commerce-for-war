import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../../modules/users/users.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { User } from '../../modules/users/entities/user.entity';
import { APP_RESPONSE, buildResponse } from '../constants/response.constants';
import { CreateCodeResetPasswordDto } from './dto/create-code-reset-password.dto';
import { RedisService } from '../redis/redis.service';
import { CheckCodeResetPasswordDto } from './dto/check-code-reset-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ChangeInfoAfterSignupDto } from './dto/change-info-after-signup.dto';
import { UserRole } from '../../modules/users/enums/user-role.enum';
import { DataSource } from 'typeorm';
import { Wallet } from '../../modules/wallets/entities/wallet.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
    private readonly dataSource: DataSource,
  ) { }

  private buildActive(user: User): number {
    return user.fullname && user.avatar ? 1 : -1;
  }

  private buildLoginResponse(user: User, token: string) {
    return buildResponse(APP_RESPONSE.OK, {
      id: user.id,
      username: user.username,
      token,
      avatar: user.avatar,
      cover_image: user.cover_image,
      cover_image_web: user.cover_image_web,
      active: this.buildActive(user),
    });
  }

  private generateOtp(length = 6): string {
    // 1. Tính toán giá trị lớn nhất (Ví dụ: 10^6 = 1,000,000)
    const max = Math.pow(10, length);

    // 2. Lấy ngẫu nhiên từ 0 đến 999,999
    const randomNum = Math.floor(Math.random() * max);

    // 3. Nếu số nhỏ hơn 6 chữ số (VD: 1234), tự động bù số 0 vào đầu (VD: 001234)
    return randomNum.toString().padStart(length, '0');
  }

  private buildResetPasswordRedisKey(phoneNumber: string): string {
    return `reset_password:${phoneNumber}`;
  }

  private buildResetPasswordCooldownKey(phoneNumber: string): string {
    return `reset_password_cooldown:${phoneNumber}`;
  }

  private isValidVietnamesePhoneNumber(phoneNumber: string): boolean {
    return /^0(3|5|7|8|9)[0-9]{8}$/.test(phoneNumber);
  }

  private normalizePhoneNumber(phoneNumber: string): string {
    const trimmedPhoneNumber = phoneNumber.trim();

    if (trimmedPhoneNumber.startsWith('+84')) {
      return '0' + trimmedPhoneNumber.slice(3);
    }

    if (trimmedPhoneNumber.startsWith('84')) {
      return '0' + trimmedPhoneNumber.slice(2);
    }

    return trimmedPhoneNumber;
  }

  private buildResetPasswordVerifiedKey(phoneNumber: string): string {
    return `reset_password_verified:${phoneNumber}`;
  }

  private isValidUsername(username: string): boolean {
    return /^[a-zA-Z0-9_. ]{3,50}$/.test(username);
  }

  async signup(signupDto: SignupDto) {
    const normalizedPhoneNumber = this.normalizePhoneNumber(
      signupDto.phone_number,
    );

    if (!this.isValidVietnamesePhoneNumber(normalizedPhoneNumber)) {
      throw new BadRequestException(
        buildResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID, null),
      );
    }

    const existedUser = await this.usersService.findByPhone(
      normalizedPhoneNumber,
    );

    if (existedUser) {
      throw new BadRequestException(
        buildResponse(APP_RESPONSE.USER_EXISTED, null),
      );
    }

    const hashedPassword = await bcrypt.hash(signupDto.password, 10);

    const { user, wallet } = await this.dataSource.transaction(async (manager) => {
      const createdUser = manager.create(User, {
        phone_number: normalizedPhoneNumber,
        password: hashedPassword,
        uuid: signupDto.uuid,
        role: UserRole.USER,
        username: normalizedPhoneNumber,
        status: 'active',
      });

      const savedUser = await manager.save(User, createdUser);

      const createdWallet = manager.create(Wallet, {
        user_id: savedUser.id,
        available_balance: '0.000',
        pending_balance: '0.000',
      });

      const savedWallet = await manager.save(Wallet, createdWallet);

      return {
        user: savedUser,
        wallet: savedWallet,
      };
    });

    return buildResponse(APP_RESPONSE.OK, {
      id: user.id,
      username: user.username,
      wallet_id: wallet.id,
      avatar: user.avatar,
      active: this.buildActive(user),
    });
  }

  async login(loginDto: LoginDto) {
    const normalizedPhoneNumber = this.normalizePhoneNumber(
      loginDto.phone_number,
    );

    const user = await this.usersService.findByPhoneWithPassword(
      normalizedPhoneNumber,
    );

    if (!user) {
      throw new UnauthorizedException(
        buildResponse(APP_RESPONSE.USER_NOT_VALIDATED, null),
      );
    }

    let isPasswordMatched = false;
    const isHashedPassword = /^\$2[aby]\$/.test(user.password);

    if (isHashedPassword) {
      isPasswordMatched = await bcrypt.compare(
        loginDto.password,
        user.password,
      );
    } else {
      isPasswordMatched = user.password === loginDto.password;

      if (isPasswordMatched) {
        const newHashedPassword = await bcrypt.hash(loginDto.password, 10);
        await this.usersService.updatePassword(user.id, newHashedPassword);
      }
    }

    if (!isPasswordMatched) {
      throw new UnauthorizedException(
        buildResponse(APP_RESPONSE.USER_NOT_VALIDATED, null),
      );
    }

    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
    };

    const token = await this.jwtService.signAsync(payload);

    return this.buildLoginResponse(user, token);
  }

  async createCodeResetPassword(dto: CreateCodeResetPasswordDto) {
    try {
      if (!dto) {
        return buildResponse(APP_RESPONSE.PARAMETER_NOT_ENOUGH, null);
      }

      const { phone_number } = dto;

      if (
        phone_number === undefined ||
        phone_number === null ||
        phone_number === ''
      ) {
        return buildResponse(APP_RESPONSE.PARAMETER_NOT_ENOUGH, null);
      }

      if (typeof phone_number !== 'string') {
        return buildResponse(APP_RESPONSE.PARAMETER_TYPE_INVALID, null);
      }

      const normalizedPhoneNumber = this.normalizePhoneNumber(
        phone_number.trim(),
      );

      if (!this.isValidVietnamesePhoneNumber(normalizedPhoneNumber)) {
        return buildResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID, null);
      }

      const user = await this.usersService.findByPhone(normalizedPhoneNumber);

      if (!user) {
        return buildResponse(APP_RESPONSE.USER_NOT_VALIDATED, null);
      }

      // chống spam gửi OTP liên tục trong thời gian ngắn
      const cooldownKey = this.buildResetPasswordCooldownKey(
        normalizedPhoneNumber,
      );
      const existedCooldown = await this.redisService.get(cooldownKey);

      if (existedCooldown) {
        return buildResponse(APP_RESPONSE.SPAM, null);
      }

      const otpLength = Number(process.env.RESET_PASSWORD_OTP_LENGTH);
      const otpTtl = Number(process.env.RESET_PASSWORD_OTP_TTL);
      const otpCooldown = Number(process.env.RESET_PASSWORD_OTP_COOLDOWN);

      const otp = this.generateOtp(otpLength);
      const redisKey = this.buildResetPasswordRedisKey(normalizedPhoneNumber);

      // lưu OTP vào redis
      await this.redisService.set(redisKey, otp, otpTtl);

      // lưu cooldown chống spam
      await this.redisService.set(cooldownKey, '1', otpCooldown);

      // TODO: thay bằng service SMS thật
      await this.mockSendSms(normalizedPhoneNumber, otp);

      return buildResponse(APP_RESPONSE.OK, { otp: otp });
    } catch (error) {
      console.error('createCodeResetPassword error:', error);
      return buildResponse(APP_RESPONSE.EXCEPTION_ERROR, null);
    }
  }

  async checkCodeResetPassword(dto: CheckCodeResetPasswordDto) {
    const normalizedPhoneNumber = this.normalizePhoneNumber(dto.phone_number);
    const inputCode = dto.reset_code.trim();

    const redisKey = this.buildResetPasswordRedisKey(normalizedPhoneNumber);
    const savedCode = await this.redisService.get(redisKey);

    // Không tồn tại 
    if (!savedCode) {
      return buildResponse(APP_RESPONSE.CODE_VERIFY_INCORRECT, null);
    }

    // Sai mã
    if (savedCode !== inputCode) {
      return buildResponse(APP_RESPONSE.CODE_VERIFY_INCORRECT, null);
    }

    // Đúng mã:
    // xóa OTP cũ để không dùng lại
    await this.redisService.del(redisKey);

    // tạo cờ verified
    const verifiedKey = this.buildResetPasswordVerifiedKey(
      normalizedPhoneNumber,
    );
    const verifiedTtl = Number(process.env.RESET_PASSWORD_VERIFIED_TTL) || 600; // 10 phút

    await this.redisService.set(verifiedKey, '1', verifiedTtl);

    return buildResponse(APP_RESPONSE.OK, null);
  }

  async resetPassword(dto: ResetPasswordDto) {
    const normalizedPhoneNumber = this.normalizePhoneNumber(dto.phone_number);

    const user = await this.usersService.findByPhoneWithPassword(
      normalizedPhoneNumber,
    );

    if (!user) {
      return buildResponse(APP_RESPONSE.USER_NOT_VALIDATED, null);
    }

    const verifiedKey = this.buildResetPasswordVerifiedKey(
      normalizedPhoneNumber,
    );
    const isVerified = await this.redisService.get(verifiedKey);

    if (!isVerified) {
      return buildResponse(APP_RESPONSE.CODE_VERIFY_INCORRECT, null);
    }

    const isHashedPassword = /^\$2[aby]\$/.test(user.password);

    if (isHashedPassword) {
      const isSameOldPassword = await bcrypt.compare(
        dto.password,
        user.password,
      );
      if (isSameOldPassword) {
        return buildResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID, null);
      }
    } else {
      if (dto.password === user.password) {
        return buildResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID, null);
      }
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    await this.usersService.updatePassword(user.id, hashedPassword);

    await this.redisService.del(verifiedKey);

    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
    };

    const token = await this.jwtService.signAsync(payload);

    const updatedUser = {
      ...user,
      password: hashedPassword,
    };

    return this.buildLoginResponse(updatedUser as User, token);
  }

  async changePassword(dto: ChangePasswordDto, userId: string) {
    try {
      const user = await this.usersService.findByIdWithPassword(userId);

      if (!user) {
        return buildResponse(APP_RESPONSE.USER_NOT_VALIDATED, null);
      }

      let isPasswordMatched = false;
      const isHashedPassword = /^\$2[aby]\$/.test(user.password);

      if (isHashedPassword) {
        isPasswordMatched = await bcrypt.compare(dto.password, user.password);
      } else {
        isPasswordMatched = user.password === dto.password;
      }

      if (!isPasswordMatched) {
        return buildResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID, null);
      }

      if (dto.password === dto.new_password) {
        return buildResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID, null);
      }

      if (isHashedPassword) {
        const isSameOldPassword = await bcrypt.compare(
          dto.new_password,
          user.password,
        );
        if (isSameOldPassword) {
          return buildResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID, null);
        }
      }

      const hashedPassword = await bcrypt.hash(dto.new_password, 10);
      await this.usersService.updatePassword(user.id, hashedPassword);

      return buildResponse(APP_RESPONSE.OK, 'OK');
    } catch (error) {
      console.error('changePassword error:', error);
      return buildResponse(APP_RESPONSE.EXCEPTION_ERROR, null);
    }
  }

  async changeInfoAfterSignup(dto: ChangeInfoAfterSignupDto, userId: string) {
    try {
      const user = await this.usersService.findById(userId);

      if (!user) {
        return buildResponse(APP_RESPONSE.USER_NOT_VALIDATED, null);
      }

      const username = dto.username.trim();

      if (!this.isValidUsername(username)) {
        return buildResponse(APP_RESPONSE.PARAMETER_VALUE_INVALID, null);
      }

      await this.usersService.updateInfoAfterSignup(user.id, {
        username,
        avatar: dto.avatar ?? user.avatar ?? null,
      });

      const updatedUser = await this.usersService.findById(user.id);
      if (!updatedUser) {
        return buildResponse(APP_RESPONSE.USER_NOT_VALIDATED, null);
      }

      return buildResponse(APP_RESPONSE.OK, {
        id: updatedUser.id,
        username: updatedUser.username,
        phone_number: updatedUser.phone_number,
        password: updatedUser.password,
        uuid: updatedUser.uuid,
        role: updatedUser.role,
        fullname: updatedUser.fullname,
        avatar: updatedUser.avatar,
      });
    } catch (error) {
      console.error('changeInfoAfterSignup error:', error);
      return buildResponse(APP_RESPONSE.EXCEPTION_ERROR, null);
    }
  }

  async logout(userId: string) {
    try {
      const user = await this.usersService.findById(userId);

      if (!user) {
        return buildResponse(APP_RESPONSE.USER_NOT_VALIDATED, null);
      }

      // OPTIONAL: xoá dev_token để không nhận push nữa
      // await this.devTokensService.deleteByUserId(user.id);

      return buildResponse(APP_RESPONSE.OK, null);
    } catch (error) {
      console.error('logout error:', error);
      return buildResponse(APP_RESPONSE.EXCEPTION_ERROR, null);
    }
  }

  private async mockSendSms(phoneNumber: string, otp: string) {
    console.log(`[SMS MOCK] Send OTP ${otp} to ${phoneNumber}`);
  }
}
