import { Test, TestingModule } from '@nestjs/testing';
import { AchievementService } from './achievement.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AchievementService', () => {
  let service: AchievementService;
  let mockPrismaService: any;
  let mockTx: any;

  beforeEach(async () => {
    mockPrismaService = {
      badge: {
        findMany: jest.fn().mockResolvedValue([
          { id: 1, title: '첫 발걸음' },
          { id: 2, title: '7일 연속' },
          { id: 3, title: '30일 연속' },
        ]),
      },
    };

    mockTx = {
      userStats: { findUnique: jest.fn() },
      userBadge: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AchievementService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AchievementService>(AchievementService);
    // Initialize module to populate the internal badgeIdByTitle map
    await service.onModuleInit();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkAndAward', () => {
    it('should do nothing if userStats is null', async () => {
      mockTx.userStats.findUnique.mockResolvedValue(null);
      await service.checkAndAward(mockTx, 1n);
      expect(mockTx.userBadge.findMany).not.toHaveBeenCalled();
    });

    it('should award "첫 발걸음" when conditions are met and not already earned', async () => {
      mockTx.userStats.findUnique.mockResolvedValue({
        totalCompletedLessons: 1,
        currentStreak: 1,
      });
      // No badges earned yet
      mockTx.userBadge.findMany.mockResolvedValue([]);
      
      await service.checkAndAward(mockTx, 1n);

      expect(mockTx.userBadge.create).toHaveBeenCalledTimes(1);
      expect(mockTx.userBadge.create).toHaveBeenCalledWith({
        data: { userId: 1n, badgeId: 1 },
      });
    });

    it('should not award "첫 발걸음" if already earned', async () => {
      mockTx.userStats.findUnique.mockResolvedValue({
        totalCompletedLessons: 1,
        currentStreak: 1,
      });
      // Badge 1 is already earned
      mockTx.userBadge.findMany.mockResolvedValue([{ badgeId: 1 }]);
      
      await service.checkAndAward(mockTx, 1n);

      expect(mockTx.userBadge.create).not.toHaveBeenCalled();
    });

    it('should award multiple badges if multiple conditions are met', async () => {
      mockTx.userStats.findUnique.mockResolvedValue({
        totalCompletedLessons: 5,
        currentStreak: 7, // Meets both 1 lesson and 7-day streak
      });
      mockTx.userBadge.findMany.mockResolvedValue([]);
      
      await service.checkAndAward(mockTx, 1n);

      expect(mockTx.userBadge.create).toHaveBeenCalledTimes(2);
      expect(mockTx.userBadge.create).toHaveBeenCalledWith({ data: { userId: 1n, badgeId: 1 } });
      expect(mockTx.userBadge.create).toHaveBeenCalledWith({ data: { userId: 1n, badgeId: 2 } });
    });
  });
});
