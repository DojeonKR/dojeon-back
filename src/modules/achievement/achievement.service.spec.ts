import { Test, TestingModule } from '@nestjs/testing';
import { AchievementService } from './achievement.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../infra/redis/redis.service';

describe('AchievementService', () => {
  let service: AchievementService;
  let mockPrismaService: any;
  let mockTx: any;

  const badgeKeyMap: Record<string, number> = {
    signed_up: 1,
    first_start: 2,
    lesson_first: 10,
    streak_7: 5,
    learned_10m: 15,
  };

  beforeEach(async () => {
    mockPrismaService = {
      badge: {
        findMany: jest.fn().mockResolvedValue(
          Object.entries(badgeKeyMap).map(([key, id]) => ({ id, key })),
        ),
      },
    };

    mockTx = {
      userStats: { findUnique: jest.fn() },
      userBadge: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
    };

    const mockPipeline = {
      del: jest.fn().mockReturnThis(),
      hset: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };
    const mockRedisClient = {
      pipeline: jest.fn(() => mockPipeline),
      hget: jest.fn(async (_key: string, badgeKey: string) => {
        const id = badgeKeyMap[badgeKey];
        return id ? String(id) : null;
      }),
    };
    const mockRedisService = {
      getClient: jest.fn(() => mockRedisClient),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AchievementService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get<AchievementService>(AchievementService);
    await service.onModuleInit();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('awardByKey', () => {
    it('should award badge by key', async () => {
      await service.awardByKey(mockTx, 1n, 'signed_up');
      expect(mockTx.userBadge.create).toHaveBeenCalledWith({
        data: { userId: 1n, badgeId: 1 },
      });
    });

    it('should ignore unknown badge key', async () => {
      await service.awardByKey(mockTx, 1n, 'unknown_key');
      expect(mockTx.userBadge.create).not.toHaveBeenCalled();
    });
  });

  describe('checkStatBadges', () => {
    it('should do nothing if userStats is null', async () => {
      mockTx.userStats.findUnique.mockResolvedValue(null);
      await service.checkStatBadges(mockTx, 1n);
      expect(mockTx.userBadge.findMany).not.toHaveBeenCalled();
    });

    it('should award lesson_first when conditions are met and not already earned', async () => {
      mockTx.userStats.findUnique.mockResolvedValue({
        totalCompletedLessons: 1,
        totalCompletedCourses: 0,
        currentStreak: 1,
        totalStudyMin: 0,
      });
      mockTx.userBadge.findMany.mockResolvedValue([]);

      await service.checkStatBadges(mockTx, 1n);

      expect(mockTx.userBadge.create).toHaveBeenCalledTimes(1);
      expect(mockTx.userBadge.create).toHaveBeenCalledWith({
        data: { userId: 1n, badgeId: 10 },
      });
    });

    it('should not award lesson_first if already earned', async () => {
      mockTx.userStats.findUnique.mockResolvedValue({
        totalCompletedLessons: 1,
        totalCompletedCourses: 0,
        currentStreak: 1,
        totalStudyMin: 0,
      });
      mockTx.userBadge.findMany.mockResolvedValue([{ badgeId: 10 }]);

      await service.checkStatBadges(mockTx, 1n);

      expect(mockTx.userBadge.create).not.toHaveBeenCalled();
    });

    it('should award multiple badges if multiple conditions are met', async () => {
      mockTx.userStats.findUnique.mockResolvedValue({
        totalCompletedLessons: 5,
        totalCompletedCourses: 0,
        currentStreak: 7,
        totalStudyMin: 15,
      });
      mockTx.userBadge.findMany.mockResolvedValue([]);

      await service.checkStatBadges(mockTx, 1n);

      expect(mockTx.userBadge.create).toHaveBeenCalledTimes(3);
      expect(mockTx.userBadge.create).toHaveBeenCalledWith({ data: { userId: 1n, badgeId: 10 } });
      expect(mockTx.userBadge.create).toHaveBeenCalledWith({ data: { userId: 1n, badgeId: 5 } });
      expect(mockTx.userBadge.create).toHaveBeenCalledWith({ data: { userId: 1n, badgeId: 15 } });
    });
  });
});
