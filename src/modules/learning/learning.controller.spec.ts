import { Test, TestingModule } from '@nestjs/testing';
import { LearningController } from './learning.controller';
import { LearningService } from './learning.service';

describe('LearningController', () => {
  let controller: LearningController;
  let mockLearningService: any;

  beforeEach(async () => {
    mockLearningService = {
      getCoursesDashboard: jest.fn(),
      getLessonSections: jest.fn(),
      updateLessonPreferences: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LearningController],
      providers: [
        { provide: LearningService, useValue: mockLearningService },
      ],
    }).compile();

    controller = module.get<LearningController>(LearningController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should get courses dashboard', async () => {
    mockLearningService.getCoursesDashboard.mockResolvedValue({ courses: [] });
    const res = await controller.coursesDashboard({ userId: 1n } as any);
    expect(res).toEqual({ courses: [] });
  });

  it('should get lesson sections', async () => {
    mockLearningService.getLessonSections.mockResolvedValue({ sections: [] });
    const res = await controller.lessonSections({ userId: 1n } as any, 1);
    expect(res).toEqual({ sections: [] });
  });

  it('should update lesson preferences', async () => {
    mockLearningService.updateLessonPreferences.mockResolvedValue({
      lessonId: 1,
      selectedTypes: ['VOCAB', 'READING'],
    });

    const res = await controller.updateLessonPreferences(
      { userId: 1n } as any,
      1,
      { selectedTypes: ['VOCAB', 'READING'] } as any,
    );

    expect(mockLearningService.updateLessonPreferences).toHaveBeenCalledWith(1n, 1, [
      'VOCAB',
      'READING',
    ]);
    expect(res.selectedTypes).toEqual(['VOCAB', 'READING']);
  });
});
