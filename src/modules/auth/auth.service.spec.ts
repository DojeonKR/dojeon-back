import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../infra/redis/redis.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EmailQueueService } from '../../infra/email/email-queue.service';
import { AppException } from '../../common/exceptions/app.exception';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock('google-auth-library', () => {
  return {
    OAuth2Client: jest.fn().mockImplementation(() => ({
      verifyIdToken: jest.fn().mockResolvedValue({
        getPayload: () => ({ email: 'google@test.com', sub: 'google_sub_123', name: 'GoogleUser' }),
      }),
    })),
  };
});

describe('AuthService', () => {
  let service: AuthService;
  let mockPrismaService: any;
  let mockRedisService: any;
  let mockJwtService: any;
  let mockConfigService: any;
  let mockEmailQueueService: any;
  let mockTx: any;

  beforeEach(async () => {
    mockTx = {
      user: { create: jest.fn() },
      userStats: { create: jest.fn() },
    };

    mockPrismaService = {
      $transaction: jest.fn().mockImplementation((cb) => cb(mockTx)),
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      userStats: {
        create: jest.fn(),
      },
    };

    mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      incrWithTtlOnFirst: jest.fn(),
    };

    mockJwtService = {
      signAsync: jest.fn().mockResolvedValue('mock_jwt_token'),
    };

    mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'google.clientId') return 'mock-client-id';
        if (key === 'nodeEnv') return 'development';
        if (key === 'jwt.accessSecret') return 'secret';
        if (key === 'jwt.accessExpiresIn') return '30m';
        return null;
      }),
    };

    mockEmailQueueService = {
      enqueueOtp: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: EmailQueueService, useValue: mockEmailQueueService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendEmailCode', () => {
    it('should throw if cooldown is active', async () => {
      mockRedisService.get.mockResolvedValue('1');
      await expect(service.sendEmailCode('test@test.com')).rejects.toThrow(AppException);
      expect(mockRedisService.get).toHaveBeenCalledWith('email:otp:cooldown:test@test.com');
    });

    it('should set otp and enqueue email', async () => {
      mockRedisService.get.mockResolvedValue(null);
      const res = await service.sendEmailCode('test@test.com');
      expect(res.sent).toBe(true);
      expect(mockRedisService.set).toHaveBeenCalledTimes(2);
      expect(mockEmailQueueService.enqueueOtp).toHaveBeenCalled();
    });
  });

  describe('verifyEmailCode', () => {
    it('should throw if code is invalid', async () => {
      mockRedisService.get.mockResolvedValue('123456');
      await expect(service.verifyEmailCode('test@test.com', '999999')).rejects.toThrow(AppException);
    });

    it('should return verifyToken and delete otp on success', async () => {
      mockRedisService.get.mockResolvedValue('123456');
      const res = await service.verifyEmailCode('test@test.com', '123456');
      expect(res.verifyToken).toBeDefined();
      expect(mockRedisService.del).toHaveBeenCalled();
      expect(mockRedisService.set).toHaveBeenCalledWith(
        `signup:verify:${res.verifyToken}`,
        'test@test.com',
        1800,
      );
    });
  });

  describe('signup', () => {
    it('should throw if terms not agreed', async () => {
      await expect(
        service.signup({
          email: 'test@test.com',
          password: 'pw',
          isTermsAgreed: false,
          isPrivacyAgreed: true,
          isAgeVerified: true,
          verifyToken: 'token',
        }),
      ).rejects.toThrow(AppException);
    });

    it('should throw if email not verified', async () => {
      mockRedisService.get.mockResolvedValue(null);
      await expect(
        service.signup({
          email: 'test@test.com',
          password: 'pw',
          isTermsAgreed: true,
          isPrivacyAgreed: true,
          isAgeVerified: true,
          verifyToken: 'invalid_token',
        }),
      ).rejects.toThrow(AppException);
    });

    it('should signup a new user successfully', async () => {
      mockRedisService.get.mockResolvedValue('test@test.com');
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mockPrismaService.user.findFirst.mockResolvedValueOnce(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_pw');
      mockTx.user.create.mockResolvedValue({ id: 1n, email: 'test@test.com' });

      const res = await service.signup({
        email: 'test@test.com',
        password: 'pw',
        verifyToken: 'valid_token',
        isTermsAgreed: true,
        isPrivacyAgreed: true,
        isAgeVerified: true,
      });

      expect(res.accessToken).toBe('mock_jwt_token');
      expect(res.userId).toBe('1');
      expect(mockTx.user.create).toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should login and return tokens', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 1n,
        email: 'test@test.com',
        passwordHash: 'hashed_pw',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const res = await service.login({ email: 'test@test.com', password: 'pw' });
      expect(res.accessToken).toBe('mock_jwt_token');
      expect(res.userId).toBe('1');
    });

    it('should throw on invalid password', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 1n,
        email: 'test@test.com',
        passwordHash: 'hashed_pw',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login({ email: 'test@test.com', password: 'wrong' })).rejects.toThrow(AppException);
    });
  });
});
