import { Test, TestingModule } from '@nestjs/testing';
import { LogService } from './log.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AchievementService } from '../achievement/achievement.service';
import { SectionProgressDto } from './dto/section-progress.dto';
import { AppException } from '../../common/exceptions/app.exception';
import { ScrapType } from '@prisma/client';

describe('LogService - saveSectionProgress', () => {
  let service: LogService;
  let mockPrismaService: any;
  let mockAchievementService: any;
  let mockTx: any;

  beforeEach(async () => {
    mockTx = {
      section: { findUnique: jest.fn(), findFirst: jest.fn() },
      userSectionLog: { upsert: jest.fn(), count: jest.fn(), findUnique: jest.fn() },
      userStats: { findUnique: jest.fn(), update: jest.fn() },
      userAttendance: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), upsert: jest.fn(), findMany: jest.fn() },
      course: { findFirst: jest.fn() },
    };

    mockPrismaService = {
      $transaction: jest.fn().mockImplementation((cb) => cb(mockTx)),
      section: { findUnique: jest.fn() },
    };

    mockAchievementService = {
      checkAndAward: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LogService,
        { provide: PrismaService, useValue: mockPrismaService },
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

  it('should mark as completed if currentPage equals totalPages and not already completed', async () => {
    // Current state: not completed
    const existingLog = { isCompleted: false, maxPageReached: 1, totalStaySeconds: 10 };
    mockPrismaService.section.findUnique.mockResolvedValue({ 
      id: 1, 
      totalPages: 5, 
      lessonId: 10,
      lesson: { sections: [{ id: 1 }, { id: 2 }] }
    });
    // upsert returns the updated record
    mockTx.userSectionLog.upsert.mockResolvedValue({
      isCompleted: true,
      maxPageReached: 5,
      totalStaySeconds: 20,
    });
    // Stats
    mockTx.userStats.findUnique.mockResolvedValue({
      totalCompletedLessons: 0,
      totalStudyMin: 0,
      currentStreak: 0,
      maxStreak: 0,
      lastAttendanceDate: null,
    });
    mockTx.userAttendance.findUnique.mockResolvedValue(null);
    mockTx.userAttendance.findMany.mockResolvedValue([]);

    const dto: SectionProgressDto = { currentPage: 5, stayTimeSeconds: 10 }; // Last page!

    const result = await service.saveSectionProgress(1n, 1, dto);

    // Should be completed
    expect(result.log.isCompleted).toBe(true);
    // Should have checked awards (since newly completed)
    expect(mockAchievementService.checkAndAward).toHaveBeenCalledWith(mockTx, 1n);
    // Should have updated stats for study min
    expect(mockTx.userStats.update).toHaveBeenCalled();
  });

  it('should NOT checkAndAward if log was already completed before', async () => {
    // Section settings
    mockPrismaService.section.findUnique.mockResolvedValue({ 
      id: 1, 
      totalPages: 5, 
      lessonId: 10,
      lesson: { sections: [{ id: 1 }, { id: 2 }] }
    });
    
    // We need to mock findUnique for the 'beforeLog' call since LogService does:
    mockTx.userSectionLog.findUnique = jest.fn().mockResolvedValue({
      isCompleted: true,
      maxPageReached: 5,
      totalStaySeconds: 20,
    });

    mockTx.userSectionLog.upsert.mockResolvedValue({
      isCompleted: true,
      maxPageReached: 5,
      totalStaySeconds: 30, // Updated time
    });

    mockTx.userStats.findUnique.mockResolvedValue({ totalStudyMin: 0 });
    mockTx.userAttendance.findUnique.mockResolvedValue({ attendanceDate: new Date() });
    mockTx.userAttendance.findMany.mockResolvedValue([]);

    const dto: SectionProgressDto = { currentPage: 5, stayTimeSeconds: 10 }; 

    const result = await service.saveSectionProgress(1n, 1, dto);

    // Should be completed
    expect(result.log.isCompleted).toBe(true);
    // Should NOT have checked awards (since already completed before)
    expect(mockAchievementService.checkAndAward).not.toHaveBeenCalled();
  });
});
