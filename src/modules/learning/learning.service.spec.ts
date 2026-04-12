import { Test, TestingModule } from '@nestjs/testing';
import { LearningService } from './learning.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app.exception';

describe('LearningService', () => {
  let service: LearningService;
  let mockPrismaService: any;

  beforeEach(async () => {
    mockPrismaService = {
      userSectionLog: {
        findFirst: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      course: {
        findMany: jest.fn(),
      },
      lesson: {
        findUnique: jest.fn(),
      },
      sectionCard: { groupBy: jest.fn() },
      sectionMaterial: { groupBy: jest.fn() },
      sectionQuestion: { groupBy: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LearningService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<LearningService>(LearningService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getLastLessonResume', () => {
    it('should return null if no logs found', async () => {
      mockPrismaService.userSectionLog.findFirst.mockResolvedValue(null);
      const res = await service.getLastLessonResume(1n);
      expect(res).toBeNull();
    });

    it('should return resume snapshot', async () => {
      mockPrismaService.userSectionLog.findFirst.mockResolvedValue({
        section: {
          id: 1, title: 'Sec1', type: 'GRAMMAR', lessonId: 2,
          materials: [{ type: 'GRAMMAR_TABLE', contentText: { title: 'grammar preview' } }],
          lesson: {
            courseId: 3, title: 'Lesson', course: { title: 'Course' }, sections: [{ id: 1 }, { id: 2 }]
          }
        }
      });
      mockPrismaService.userSectionLog.count.mockResolvedValue(1);

      const res = await service.getLastLessonResume(1n);
      expect(res?.overallProgressPercent).toBe(50);
      expect(res?.grammarPreview).toBe('grammar preview');
    });
  });

  describe('getCoursesDashboard', () => {
    it('should return dashboard lists', async () => {
      mockPrismaService.course.findMany.mockResolvedValue([
        { id: 1, title: 'C1', isActive: true, lessons: [
          { id: 1, sections: [{ id: 1 }] }
        ]}
      ]);
      mockPrismaService.userSectionLog.findMany.mockResolvedValue([{ sectionId: 1, isCompleted: true, totalStaySeconds: 10 }]);
      mockPrismaService.userSectionLog.findFirst.mockResolvedValue(null);

      const res = await service.getCoursesDashboard(1n);
      expect(res.courses.length).toBe(1);
      expect(res.courses[0].overallProgressPercent).toBe(100);
      expect(res.resumeBanner).toBeNull();
    });
  });

  describe('getLessonSections', () => {
    it('should throw if lesson not found', async () => {
      mockPrismaService.lesson.findUnique.mockResolvedValue(null);
      await expect(service.getLessonSections(1n, 1)).rejects.toThrow(AppException);
    });

    it('should return lesson sections with progress', async () => {
      mockPrismaService.lesson.findUnique.mockResolvedValue({
        id: 1, courseId: 1, title: 'Lesson', course: { lessons: [] }, sections: [{ id: 1, type: 'VOCAB', totalPages: 10 }]
      });
      mockPrismaService.userSectionLog.findMany.mockResolvedValue([
        { sectionId: 1, maxPageReached: 5, isCompleted: false }
      ]);
      mockPrismaService.sectionCard.groupBy.mockResolvedValue([{ sectionId: 1, _count: { _all: 5 } }]);
      mockPrismaService.sectionMaterial.groupBy.mockResolvedValue([]);
      mockPrismaService.sectionQuestion.groupBy.mockResolvedValue([]);

      const res = await service.getLessonSections(1n, 1);
      expect(res.sections[0].progressPercent).toBe(50);
      expect(res.sections[0].hasContent).toBe(true);
    });
  });
});
