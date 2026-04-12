import { Test, TestingModule } from '@nestjs/testing';
import { PracticeController } from './practice.controller';
import { PracticeService } from './practice.service';

describe('PracticeController', () => {
  let controller: PracticeController;
  let mockPracticeService: any;

  beforeEach(async () => {
    mockPracticeService = {
      listTopics: jest.fn(),
      listQuestions: jest.fn(),
      checkPracticeQuestion: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PracticeController],
      providers: [
        { provide: PracticeService, useValue: mockPracticeService },
      ],
    }).compile();

    controller = module.get<PracticeController>(PracticeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should list topics', async () => {
    mockPracticeService.listTopics.mockResolvedValue({ topics: [] });
    const res = await controller.topics();
    expect(res).toEqual({ topics: [] });
  });

  it('should list questions', async () => {
    mockPracticeService.listQuestions.mockResolvedValue({ topicId: 1, questions: [] });
    const res = await controller.questions(1);
    expect(res).toEqual({ topicId: 1, questions: [] });
  });

  it('should check question', async () => {
    mockPracticeService.checkPracticeQuestion.mockResolvedValue({ correct: true });
    const res = await controller.checkQuestion({ userId: 1n } as any, 1, { questionId: 1, userAnswer: 'ans' });
    expect(res).toEqual({ correct: true });
  });
});
