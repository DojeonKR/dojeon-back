import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { LogService } from './log.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SectionProgressDto } from './dto/section-progress.dto';
import { AppException } from '../../common/exceptions/app.exception';
import { SECTION_EVENT_QUEUE } from './log-event.queue';
import { AchievementService } from '../achievement/achievement.service';

describe('LogService - saveSectionProgress', () => {
  let service: LogService;
  let mockPrismaService: any;
  let mockSectionEventQueue: { add: jest.Mock };
  let mockAchievementService: { awardByKey: jest.Mock; checkStatBadges: jest.Mock };
  let mockTx: any;

  beforeEach(async () => {
    mockTx = {
      $queryRaw: jest.fn(),
      section: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
      userSectionLog: { upsert: jest.fn(), count: jest.fn(), findUnique: jest.fn() },
      userSectionPageLog: { upsert: jest.fn() },
      userStats: { update: jest.fn() },
    };

    mockPrismaService = {
      $transaction: jest.fn().mockImplementation((cb) => cb(mockTx)),
      section: { findUnique: jest.fn() },
      userSectionLog: { findUnique: jest.fn() },
      userSectionPageLog: { findMany: jest.fn() },
    };

    mockSectionEventQueue = { add: jest.fn().mockResolvedValue(undefined) };
    mockAchievementService = {
      awardByKey: jest.fn().mockResolvedValue(undefined),
      checkStatBadges: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LogService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: getQueueToken(SECTION_EVENT_QUEUE), useValue: mockSectionEventQueue },
        { provide: AchievementService, useValue: mockAchievementService },
      ],
    }).compile();

    service = module.get<LogService>(LogService);
  });

  it('should throw AppException if section does not exist', async () => {
    mockPrismaService.section.findUnique.mockResolvedValue(null);
    const dto: SectionProgressDto = { currentPage: 1, stayTimeSeconds: 10 };
    await expect(service.saveSectionProgress(1n, 999, dto)).rejects.toThrow(AppException);
  });

  it('should enqueue section.completed job when section is newly completed', async () => {
    mockPrismaService.section.findUnique.mockResolvedValue({
      id: 1,
      totalPages: 5,
      lessonId: 10,
      orderNum: 1,
      lesson: { courseId: 1, sections: [{ id: 1 }, { id: 2 }] },
    });
    mockTx.userSectionLog.count.mockResolvedValue(0);
    mockTx.userSectionLog.findUnique.mockResolvedValue({
      isCompleted: false,
      maxPageReached: 1,
      totalStaySeconds: 50,
    });
    mockTx.userSectionLog.upsert.mockResolvedValue({
      isCompleted: true,
      maxPageReached: 5,
      totalStaySeconds: 60,
    });
    mockTx.section.findFirst.mockResolvedValue(null);

    const dto: SectionProgressDto = { currentPage: 5, stayTimeSeconds: 10 };
    const result = await service.saveSectionProgress(1n, 1, dto);

    expect(result.log.isCompleted).toBe(true);
    expect(mockSectionEventQueue.add).toHaveBeenCalledWith(
      'section.completed',
      expect.objectContaining({ type: 'section.completed', userId: '1' }),
      expect.any(Object),
    );
    expect(mockTx.userStats.update).toHaveBeenCalled();
    expect(mockAchievementService.checkStatBadges).toHaveBeenCalledWith(mockTx, 1n);
  });

  it('should NOT enqueue section.completed if log was already completed before', async () => {
    mockPrismaService.section.findUnique.mockResolvedValue({
      id: 1,
      totalPages: 5,
      lessonId: 10,
      orderNum: 1,
      lesson: { courseId: 1, sections: [{ id: 1 }, { id: 2 }] },
    });
    mockTx.userSectionLog.count.mockResolvedValue(1);
    mockTx.userSectionLog.findUnique.mockResolvedValue({
      isCompleted: true,
      maxPageReached: 5,
      totalStaySeconds: 20,
    });
    mockTx.userSectionLog.upsert.mockResolvedValue({
      isCompleted: true,
      maxPageReached: 5,
      totalStaySeconds: 30,
    });
    mockTx.section.findFirst.mockResolvedValue(null);

    const dto: SectionProgressDto = { currentPage: 5, stayTimeSeconds: 10 };
    const result = await service.saveSectionProgress(1n, 1, dto);

    expect(result.log.isCompleted).toBe(true);
    expect(mockSectionEventQueue.add).not.toHaveBeenCalledWith(
      'section.completed',
      expect.anything(),
      expect.anything(),
    );
  });

  it('should accumulate stay time for the specified page', async () => {
    mockPrismaService.section.findUnique.mockResolvedValue({
      id: 1,
      type: 'VOCAB',
      totalPages: 5,
      lessonId: 10,
      orderNum: 1,
      lesson: { courseId: 1, sections: [{ id: 1 }] },
    });
    mockTx.userSectionLog.count.mockResolvedValue(0);
    mockTx.userSectionLog.findUnique.mockResolvedValue({
      isCompleted: false,
      maxPageReached: 1,
      totalStaySeconds: 5,
    });
    mockTx.userSectionLog.upsert.mockResolvedValue({
      isCompleted: false,
      maxPageReached: 2,
      totalStaySeconds: 17,
      difficulty: null,
    });
    mockTx.section.findFirst.mockResolvedValue(null);

    await service.saveSectionProgress(1n, 1, {
      currentPage: 2,
      pageNumber: 2,
      stayTimeSeconds: 12,
    });

    expect(mockTx.userSectionPageLog.upsert).toHaveBeenCalledWith({
      where: {
        userId_sectionId_pageNumber: { userId: 1n, sectionId: 1, pageNumber: 2 },
      },
      create: {
        userId: 1n,
        sectionId: 1,
        pageNumber: 2,
        totalStaySeconds: 12,
      },
      update: { totalStaySeconds: { increment: 12 } },
    });
  });

  it('should move the aggregate counter when a completed grammar rating changes', async () => {
    mockPrismaService.section.findUnique.mockResolvedValue({
      id: 1,
      type: 'GRAMMAR',
      totalPages: 5,
      lessonId: 10,
      orderNum: 1,
      lesson: { courseId: 1, sections: [{ id: 1 }] },
    });
    mockTx.userSectionLog.count.mockResolvedValue(1);
    mockTx.userSectionLog.findUnique.mockResolvedValue({
      isCompleted: true,
      difficulty: 'EASY',
      maxPageReached: 5,
      totalStaySeconds: 20,
    });
    mockTx.userSectionLog.upsert.mockResolvedValue({
      isCompleted: true,
      difficulty: 'HARD',
      maxPageReached: 5,
      totalStaySeconds: 20,
    });
    mockTx.section.findFirst.mockResolvedValue(null);

    await service.saveSectionProgress(1n, 1, {
      currentPage: 5,
      stayTimeSeconds: 0,
      difficulty: 'HARD',
    });

    expect(mockTx.section.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        difficultyEasyCount: { decrement: 1 },
        difficultyHardCount: { increment: 1 },
      },
    });
  });

  it('should return page stay times and grammar rating counters', async () => {
    mockPrismaService.section.findUnique.mockResolvedValue({
      id: 1,
      type: 'GRAMMAR',
      difficultyEasyCount: 3,
      difficultyNormalCount: 5,
      difficultyHardCount: 2,
    });
    mockPrismaService.userSectionLog.findUnique.mockResolvedValue({
      maxPageReached: 3,
      isCompleted: true,
      totalStaySeconds: 50,
      difficulty: 'NORMAL',
    });
    mockPrismaService.userSectionPageLog.findMany.mockResolvedValue([
      { pageNumber: 0, totalStaySeconds: 20 },
      { pageNumber: 1, totalStaySeconds: 30 },
    ]);

    const result = await service.getSectionProgressForUser(1n, 1);

    expect(result.pageStayTimes).toEqual([
      { pageNumber: 0, stayTimeSeconds: 20 },
      { pageNumber: 1, stayTimeSeconds: 30 },
    ]);
    expect(result.difficultyCounts).toEqual({ easy: 3, normal: 5, hard: 2 });
  });
});
