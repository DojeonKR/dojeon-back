import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { LogService } from './log.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SectionProgressDto } from './dto/section-progress.dto';
import { AppException } from '../../common/exceptions/app.exception';
import { SECTION_EVENT_QUEUE } from './log-event.queue';

describe('LogService - saveSectionProgress', () => {
  let service: LogService;
  let mockPrismaService: any;
  let mockSectionEventQueue: { add: jest.Mock };
  let mockTx: any;

  beforeEach(async () => {
    mockTx = {
      section: { findUnique: jest.fn(), findFirst: jest.fn() },
      userSectionLog: { upsert: jest.fn(), count: jest.fn(), findUnique: jest.fn() },
      userStats: { update: jest.fn() },
    };

    mockPrismaService = {
      $transaction: jest.fn().mockImplementation((cb) => cb(mockTx)),
      section: { findUnique: jest.fn() },
    };

    mockSectionEventQueue = { add: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LogService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: getQueueToken(SECTION_EVENT_QUEUE), useValue: mockSectionEventQueue },
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
      totalStaySeconds: 10,
    });
    mockTx.userSectionLog.upsert.mockResolvedValue({
      isCompleted: true,
      maxPageReached: 5,
      totalStaySeconds: 20,
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
});
