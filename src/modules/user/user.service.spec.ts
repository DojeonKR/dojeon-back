import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { LearningService } from '../learning/learning.service';
import { RedisService } from '../../infra/redis/redis.service';
import { AppException } from '../../common/exceptions/app.exception';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(),
  PutObjectCommand: jest.fn(),
}));
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://mock-presigned-url.com'),
}));

describe('UserService', () => {
  let service: UserService;
  let mockPrismaService: any;
  let mockConfigService: any;
  let mockLearningService: any;
  const mockRedisService = { del: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    mockPrismaService = {
      user: { findUnique: jest.fn(), update: jest.fn() },
      userAttendance: { findMany: jest.fn() },
      badge: { findMany: jest.fn() },
      userBadge: { findMany: jest.fn() },
    };

    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'aws.region') return 'ap-northeast-2';
        if (key === 'aws.s3Bucket') return 'mock-bucket';
        if (key === 'cloudfrontBaseUrl') return 'https://d123.cloudfront.net';
        return null;
      }),
    };

    mockLearningService = {
      getLastLessonResume: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: LearningService, useValue: mockLearningService },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDashboard', () => {
    it('should throw if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      await expect(service.getDashboard(1n)).rejects.toThrow(AppException);
    });

    it('should return dashboard data', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 1n,
        email: 'test@example.com',
        userBadges: [],
        stats: { totalStudyMin: 10 }
      });
      mockPrismaService.userAttendance.findMany.mockResolvedValue([]);
      
      const res = await service.getDashboard(1n, 2026, 4);
      expect(res.profile.email).toBe('test@example.com');
      expect(res.stats?.totalStudyMin).toBe(10);
      expect(res.attendance.year).toBe(2026);
    });
  });

  describe('patchMe', () => {
    it('should throw AppException on duplicate constraint', async () => {
      mockPrismaService.user.update.mockRejectedValue({ code: 'P2002' });
      await expect(service.patchMe(1n, { nickname: 'dup' })).rejects.toThrow(AppException);
    });

    it('should update user successfully', async () => {
      mockPrismaService.user.update.mockResolvedValue({ id: 1n });
      const res = await service.patchMe(1n, { nickname: 'newNick' });
      expect(res.updated).toBe(true);
    });
  });

  describe('changePassword', () => {
    it('should throw if password not set (social login)', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 1n, passwordHash: null });
      await expect(service.changePassword(1n, { currentPassword: 'pw', newPassword: 'new' })).rejects.toThrow(AppException);
    });

    it('should throw if current password incorrect', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 1n, passwordHash: 'hash' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(service.changePassword(1n, { currentPassword: 'pw', newPassword: 'new' })).rejects.toThrow(AppException);
    });

    it('should change password successfully', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 1n, passwordHash: 'hash' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new_hash');
      mockPrismaService.user.update.mockResolvedValue({ id: 1n });
      
      const res = await service.changePassword(1n, { currentPassword: 'pw', newPassword: 'new' });
      expect(res.updated).toBe(true);
      expect(mockRedisService.del).toHaveBeenCalledWith('jwt:user:1');
    });
  });

  describe('getAchievementsList', () => {
    it('should format earned and unearned badges', async () => {
      mockPrismaService.badge.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      mockPrismaService.userBadge.findMany.mockResolvedValue([{ badgeId: 1, earnedAt: new Date() }]);
      
      const res = await service.getAchievementsList(1n);
      expect(res.totalEarned).toBe(1);
      expect(res.badges[0].isEarned).toBe(true);
      expect(res.badges[1].isEarned).toBe(false);
    });
  });

  describe('createProfileImagePresignedUrl', () => {
    it('should return upload url', async () => {
      const res = await service.createProfileImagePresignedUrl(1n, { fileExtension: 'jpg', contentType: 'image/jpeg' });
      expect(res.uploadUrl).toBe('https://mock-presigned-url.com');
      expect(res.fileUrl).toContain('cloudfront');
    });
  });
});
