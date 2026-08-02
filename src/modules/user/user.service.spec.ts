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
  const mockRedisService = {
    del: jest.fn().mockResolvedValue(undefined),
    sMembers: jest.fn().mockResolvedValue([]),
    delMany: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    mockPrismaService = {
      user: { findUnique: jest.fn(), update: jest.fn() },
      userAttendance: { findMany: jest.fn() },
      userDailyActivity: { findMany: jest.fn().mockResolvedValue([]) },
      scrap: { count: jest.fn().mockResolvedValue(0) },
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
        timezone: 'UTC',
        weeklyGoalMin: null,
        userBadges: [],
        stats: { totalStudyMin: 10 },
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
    it('should change password successfully', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('new_hash');
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPrismaService.user.findUnique.mockResolvedValue({
        passwordHash: 'old_hash',
        socialProvider: null,
        socialUid: null,
      });
      mockPrismaService.user.update.mockResolvedValue({ id: 1n });

      const res = await service.changePassword(1n, {
        currentPassword: 'OldPassword1!',
        newPassword: 'Password1!',
      });
      expect(res.updated).toBe(true);
      expect(mockRedisService.delMany).toHaveBeenCalledWith(
        expect.arrayContaining(['jwt:user:1', 'user:tokens:1']),
      );
    });

    it('should reject a password change without the correct current password', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      mockPrismaService.user.findUnique.mockResolvedValue({
        passwordHash: 'old_hash',
        socialProvider: null,
        socialUid: null,
      });

      await expect(
        service.changePassword(1n, {
          currentPassword: 'wrong',
          newPassword: 'Password1!',
        }),
      ).rejects.toThrow(AppException);
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });
  });

  describe('getAchievementsList', () => {
    it('should format earned and unearned badges by category', async () => {
      mockPrismaService.badge.findMany.mockResolvedValue([
        {
          id: 1,
          key: 'signed_up',
          title: 'Signed up',
          description: 'You joined DOJEON.',
          category: 'onboarding',
          sortOrder: 1,
          imageUrl: 'https://...',
        },
        {
          id: 2,
          key: 'first_start',
          title: 'First Start',
          description: 'Started learning.',
          category: 'onboarding',
          sortOrder: 2,
          imageUrl: 'https://...',
        },
      ]);
      mockPrismaService.userBadge.findMany.mockResolvedValue([
        { badgeId: 1, earnedAt: new Date() },
      ]);

      const res = await service.getAchievementsList(1n);
      expect(res.totalEarned).toBe(1);
      expect(res.categories).toHaveLength(1);
      expect(res.categories[0].category).toBe('onboarding');
      expect(res.categories[0].badges[0].isEarned).toBe(true);
      expect(res.categories[0].badges[1].isEarned).toBe(false);
    });
  });

  describe('createProfileImagePresignedUrl', () => {
    it('should return upload url', async () => {
      const res = await service.createProfileImagePresignedUrl(1n, {
        fileExtension: 'jpg',
        contentType: 'image/jpeg',
        fileSizeBytes: 1024,
      });
      expect(res.uploadUrl).toBe('https://mock-presigned-url.com');
      expect(res.fileUrl).toContain('cloudfront');
    });
  });
});
