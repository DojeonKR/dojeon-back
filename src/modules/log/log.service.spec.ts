import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { LogService } from './log.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SectionProgressDto } from './dto/section-progress.dto';
import { AppException } from '../../common/exceptions/app.exception';
import { SECTION_EVENT_QUEUE } from './log-event.queue';
import { AchievementService } from '../achievement/achievement.service';
import { ScrapType } from '@prisma/client';

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
      userDailyActivity: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockImplementation(({ create }) =>
          Promise.resolve({
            ...create,
            goalAchieved: false,
            dailyGoalMinSnapshot: create.dailyGoalMinSnapshot ?? null,
          }),
        ),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      userStats: {
        findUnique: jest.fn().mockResolvedValue({ currentStreak: 0, maxStreak: 0 }),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    mockPrismaService = {
      $transaction: jest.fn().mockImplementation((cb) => cb(mockTx)),
      section: { findUnique: jest.fn() },
      sectionQuestion: { findFirst: jest.fn() },
      userSectionQuestionStat: { upsert: jest.fn() },
      user: {
        findUnique: jest.fn().mockResolvedValue({ timezone: 'UTC', dailyGoalMin: 15 }),
      },
      userSectionLog: { findUnique: jest.fn() },
      userSectionPageLog: { findMany: jest.fn() },
      sectionCard: { findUnique: jest.fn() },
      sectionMaterial: { findUnique: jest.fn() },
      scrap: {
        updateMany: jest.fn(),
        findFirst: jest.fn(),
        findFirstOrThrow: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
      },
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
    expect(mockTx.userDailyActivity.upsert).toHaveBeenCalled();
    expect(mockAchievementService.checkStatBadges).toHaveBeenCalledWith(mockTx, 1n);
  });

  it('should complete the section when the isCompleted alias is sent', async () => {
    mockPrismaService.section.findUnique.mockResolvedValue({
      id: 1,
      totalPages: 5,
      lessonId: 10,
      orderNum: 1,
      lesson: { courseId: 1, sections: [{ id: 1 }, { id: 2 }] },
    });
    mockTx.userSectionLog.count.mockResolvedValue(0);
    mockTx.userSectionLog.findUnique.mockResolvedValue(null);
    mockTx.userSectionLog.upsert.mockResolvedValue({
      isCompleted: true,
      maxPageReached: 1,
      totalStaySeconds: 10,
    });
    mockTx.section.findFirst.mockResolvedValue(null);

    const dto: SectionProgressDto = { currentPage: 1, stayTimeSeconds: 10, isCompleted: true };
    await service.saveSectionProgress(1n, 1, dto);

    expect(mockTx.userSectionLog.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ isCompleted: true }),
      }),
    );
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
      type: ScrapType.VOCAB,
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

  it('should atomically increment the per-user section question counter', async () => {
    mockPrismaService.section.findUnique.mockResolvedValue({ id: 1 });
    mockPrismaService.sectionQuestion.findFirst.mockResolvedValue({
      id: 11,
      answer: '정답',
      explanation: null,
    });

    const result = await service.checkSectionQuestion(1n, 1, {
      questionId: 11,
      userAnswer: '오답',
    });

    expect(result).toEqual({ correct: false });
    expect(mockPrismaService.userSectionQuestionStat.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_questionId: { userId: 1n, questionId: 11 } },
        create: expect.objectContaining({ correctCount: 0, wrongCount: 1 }),
        update: expect.objectContaining({ wrongCount: { increment: 1 } }),
      }),
    );
  });

  it('should mark the local daily goal achieved and calculate a goal-based streak', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-02T12:00:00.000Z'));
    mockPrismaService.user.findUnique.mockResolvedValue({ timezone: 'UTC', dailyGoalMin: 1 });
    mockPrismaService.section.findUnique.mockResolvedValue({
      id: 1,
      type: 'VOCAB',
      totalPages: 5,
      lessonId: 10,
      orderNum: 1,
      lesson: { courseId: 1, sections: [{ id: 1 }] },
    });
    mockTx.userSectionLog.count.mockResolvedValue(0);
    mockTx.userSectionLog.findUnique.mockResolvedValue(null);
    mockTx.userSectionLog.upsert.mockResolvedValue({
      isCompleted: false,
      maxPageReached: 1,
      totalStaySeconds: 60,
      difficulty: null,
    });
    mockTx.userDailyActivity.upsert.mockResolvedValue({
      activityDate: new Date('2026-08-02T00:00:00.000Z'),
      studySeconds: 60,
      dailyGoalMinSnapshot: 1,
      goalAchieved: false,
    });
    mockTx.userDailyActivity.updateMany.mockResolvedValue({ count: 1 });
    mockTx.userDailyActivity.findMany.mockResolvedValue([
      { activityDate: new Date('2026-08-02T00:00:00.000Z') },
    ]);
    mockTx.section.findFirst.mockResolvedValue(null);

    await service.saveSectionProgress(1n, 1, {
      currentPage: 1,
      stayTimeSeconds: 60,
    });

    expect(mockTx.userDailyActivity.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ goalAchieved: false }),
        data: expect.objectContaining({ goalAchieved: true }),
      }),
    );
    expect(mockTx.userStats.update).toHaveBeenCalledWith({
      where: { userId: 1n },
      data: expect.objectContaining({ currentStreak: 1 }),
    });
    jest.useRealTimers();
  });

  it('should reactivate an existing notebook item and debounce the add counter', async () => {
    const stateChangedAt = new Date('2026-08-02T12:00:00.000Z');
    mockPrismaService.sectionCard.findUnique.mockResolvedValue({ id: 7, sectionId: 3 });
    mockPrismaService.scrap.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 9n });
    mockPrismaService.scrap.updateMany.mockResolvedValue({ count: 1 });
    mockPrismaService.scrap.findUniqueOrThrow.mockResolvedValue({
      id: 9n,
      cardId: 7,
      isActive: true,
      countedIsActive: false,
      addCount: 1,
      lastStateChangedAt: stateChangedAt,
    });

    const result = await service.createScrap(1n, {
      type: 'VOCAB',
      cardId: 7,
      sectionId: 3,
    });

    expect(mockPrismaService.scrap.updateMany).toHaveBeenCalledWith({
      where: { id: 9n, userId: 1n, isActive: false },
      data: expect.objectContaining({ isActive: true }),
    });
    expect(mockSectionEventQueue.add).toHaveBeenCalledWith(
      'scrap.state.settled',
      expect.objectContaining({ scrapId: '9', stateChangedAt: stateChangedAt.toISOString() }),
      expect.objectContaining({ delay: 3000 }),
    );
    expect(result).toEqual(expect.objectContaining({ isActive: true, addCount: 1 }));
  });

  it('should soft-delete a notebook item and debounce the remove counter', async () => {
    mockPrismaService.scrap.findUnique.mockResolvedValue({
      id: 9n,
      userId: 1n,
      isActive: true,
      countedIsActive: true,
    });
    mockPrismaService.scrap.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.deleteScrap(1n, 9n)).resolves.toEqual({ deleted: true });
    expect(mockPrismaService.scrap.updateMany).toHaveBeenCalledWith({
      where: { id: 9n, userId: 1n, isActive: true },
      data: expect.objectContaining({
        isActive: false,
      }),
    });
    expect(mockSectionEventQueue.add).toHaveBeenCalledWith(
      'scrap.state.settled',
      expect.objectContaining({ scrapId: '9' }),
      expect.objectContaining({ delay: 3000 }),
    );
  });
});
