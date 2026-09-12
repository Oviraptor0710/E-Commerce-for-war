import '../setup-env';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '../../src/common/validation.pipe';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { DataSource } from 'typeorm';
// import { clearDatabase } from '../utils/db.util'; // Không dùng nữa (Non-destructive testing)
import bcrypt from 'bcrypt';
import { User } from '../../src/modules/users/entities/user.entity';
import { Wallet } from '../../src/modules/wallets/entities/wallet.entity';
import { INITIAL_WALLET_BALANCE } from '../../src/common/constants/wallet.constants';
import * as fs from 'fs';
import * as path from 'path';

describe('Auth - Signup (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let currentTestPhone: string;
  let baseURL: string | any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
    dataSource = app.get(DataSource);

    baseURL = process.env.TEST_API_URL || app.getHttpServer();

    // Sinh SĐT ngẫu nhiên dựa trên timestamp
    const validPrefixes = ['3', '5', '7', '8', '9'];
    const prefix =
      validPrefixes[Math.floor(Math.random() * validPrefixes.length)];
    const suffix = Date.now().toString().slice(-8);
    currentTestPhone = '0' + prefix + suffix;

    const contextPath = path.join(__dirname, 'test-context.json');
    fs.writeFileSync(
      contextPath,
      JSON.stringify({
        phone_number: currentTestPhone,
        password: 'password123',
      }),
    );
  }, 60000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  }, 60000);

  it('SIGNUP-01: (Thành công) - Lưu user mới vào Database', async () => {
    const signupData = {
      phone_number: currentTestPhone,
      password: 'password123',
      uuid: 'device-id-123',
    };

    // Bắn request
    const res = await request(baseURL).post('/auth/signup').send(signupData);

    // Kì vọng API trả về 1000
    expect(res.body.code).toBe('1000');
    expect(res.body.message).toMatch('OK.');

    // OUTPUT: Kiểm tra cấu trúc và giá trị data trả về
    const data = res.body.data;
    expect(typeof data.id).toBe('number');
    expect(data.id).toBeGreaterThan(0);
    expect(data.username).toBe(signupData.phone_number);
    expect(typeof data.wallet_id).toBe('number');
    expect(data.wallet_id).toBeGreaterThan(0);
    expect(data.avatar).toBeNull();
    expect(data.active).toBe(-1);
    expect(data.token).toBeUndefined();

    const userRepository = dataSource.getRepository(User);
    const walletRepository = dataSource.getRepository(Wallet);

    // Nếu test trên server từ xa (baseURL là remote URL), đồng bộ thông tin user mới này vào DB local
    if (typeof baseURL === 'string' && baseURL.startsWith('http')) {
      const hashedPassword = await bcrypt.hash(signupData.password, 10);
      await userRepository.save({
        id: data.id,
        phone_number: signupData.phone_number,
        password: hashedPassword,
        uuid: signupData.uuid,
        role: 'user',
        username: signupData.phone_number,
        status: 'active',
      });
      await walletRepository.save({
        id: data.wallet_id,
        user_id: data.id,
        available_balance: INITIAL_WALLET_BALANCE.toFixed(3),
        pending_balance: '0.000',
      });
    }

    const dbUser = await userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.phone_number = :phone', { phone: signupData.phone_number })
      .getOne();

    expect(dbUser).toBeDefined();
    expect(dbUser!.phone_number).toBe(signupData.phone_number);
    const isMatched = await bcrypt.compare(
      signupData.password,
      dbUser!.password,
    );
    expect(isMatched).toBe(true);

    const dbWallet = await walletRepository.findOne({
      where: { user_id: dbUser!.id },
    });

    expect(dbWallet).toBeDefined();
    expect(dbWallet!.id).toBe(data.wallet_id);
    expect(Number(dbWallet!.available_balance)).toBe(INITIAL_WALLET_BALANCE);
    expect(Number(dbWallet!.pending_balance)).toBe(0);
  });

  it('SIGNUP-02: (Thất bại) - Lỗi 9996 khi SĐT trùng lặp', async () => {
    const signupData = {
      phone_number: currentTestPhone,
      password: 'password123',
      uuid: 'device-id-123',
    };

    const res = await request(baseURL).post('/auth/signup').send(signupData);

    expect(res.body.code).toBe('9996');
    expect(res.body.message).toBe('User existed.');
  });

  it('SIGNUP-03: (Thất bại) - Lỗi 1002 khi thiếu điện thoại hoặc mật khẩu', async () => {
    // Thiếu phone_number
    const res1 = await request(baseURL).post('/auth/signup').send({
      password: 'password123',
      uuid: 'device-id-123',
    });
    expect(res1.body.code).toBe('1002');
    expect(res1.body.message).toBe('Parameter is not enough.');

    // Thiếu password
    const res2 = await request(baseURL).post('/auth/signup').send({
      phone_number: '0888999777',
      uuid: 'device-id-123',
    });
    expect(res2.body.code).toBe('1002');
    expect(res2.body.message).toBe('Parameter is not enough.');

    // Thiếu hoàn toàn cả phone lẫn password
    const res3 = await request(baseURL).post('/auth/signup').send({
      uuid: 'device-id-123',
    });
    expect(res3.body.code).toBe('1002');
    expect(res3.body.message).toBe('Parameter is not enough.');
  });

  it('SIGNUP-04: (Thất bại) - Lỗi 1003 khi sai kiểu dữ liệu', async () => {
    const res1 = await request(baseURL).post('/auth/signup').send({
      phone_number: 987654321,
      password: 'password123',
      uuid: 'device-id-123',
    });
    expect(res1.body.code).toBe('1003');
    expect(res1.body.message).toBe('Parameter type is invalid.');

    const res2 = await request(baseURL).post('/auth/signup').send({
      phone_number: '0888999777',
      password: 123456,
      uuid: 'device-id-123',
    });
    expect(res2.body.code).toBe('1003');
    expect(res2.body.message).toBe('Parameter type is invalid.');

    // Truyền sai kiểu cả 2 trường
    const res3 = await request(baseURL).post('/auth/signup').send({
      phone_number: 987654321,
      password: 123456,
      uuid: 'device-id-123',
    });
    expect(res3.body.code).toBe('1003');
    expect(res3.body.message).toBe('Parameter type is invalid.');
  });

  it('SIGNUP-05: (Thất bại) - Lỗi 1004 khi giá trị tham số bất thường (VD: format sai)', async () => {
    // Cả điện thoại và pass đều sai định dạng
    const res1 = await request(baseURL).post('/auth/signup').send({
      phone_number: '098', // quá ngắn
      password: '12', // quá ngắn
      uuid: 'device-id-123',
    });
    expect(res1.body.code).toBe('1004');
    expect(res1.body.message).toBe('Parameter value is invalid.');

    // SĐT sai chuẩn, password đúng chuẩn
    const res2 = await request(baseURL).post('/auth/signup').send({
      phone_number: '098', // quá ngắn
      password: 'password123',
      uuid: 'device-id-123',
    });
    expect(res2.body.code).toBe('1004');
    expect(res2.body.message).toBe('Parameter value is invalid.');

    // SĐT đúng chuẩn, password sai chuẩn
    const res3 = await request(baseURL).post('/auth/signup').send({
      phone_number: '0888999777',
      password: '12', // quá ngắn
      uuid: 'device-id-123',
    });
    expect(res3.body.code).toBe('1004');
    expect(res3.body.message).toBe('Parameter value is invalid.');
  });

  it('SIGNUP-06: (Thất bại) - Lỗi 1004 khi SĐT đúng định dạng 10 số nhưng sai đầu số nhà mạng VN (VD: 01, 02...)', async () => {
    const res = await request(baseURL).post('/auth/signup').send({
      phone_number: '0123456789', // Đầu số 01 không hợp lệ (cũ)
      password: 'password123',
      uuid: 'device-id-123',
    });
    expect(res.body.code).toBe('1004');
    expect(res.body.message).toBe('Parameter value is invalid.');
  });
});
