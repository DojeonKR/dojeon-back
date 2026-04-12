import { Test, TestingModule } from '@nestjs/testing';
import { PracticeService } from './practice.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app.exception';
import * as quizAnswerUtil from '../../common/utils/quiz-answer.util';

jest.mock('../../common/utils/quiz-answer.util', () => ({
  normalizeQuizAnswer: jest.fn(),
}));

describe('PracticeService', () => {
  let service: PracticeService;
  let mockPrismaService: any;

  beforeEach(async () => {
    mockPrismaService = {
      practiceTopic: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      practiceQuestion: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PracticeService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<PracticeService>(PracticeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('listTopics', () => {
    it('should return active topics', async () => {
      mockPrismaService.practiceTopic.findMany.mockResolvedValue([{ id: 1, titleEn: 'Topic1' }]);
      const res = await service.listTopics();
      expect(res.topics.length).toBe(1);
      expect(mockPrismaService.practiceTopic.findMany).toHaveBeenCalled();
    });
  });

  describe('listQuestions', () => {
    it('should throw if topic not found', async () => {
      mockPrismaService.practiceTopic.findUnique.mockResolvedValue(null);
      await expect(service.listQuestions(1)).rejects.toThrow(AppException);
    });

    it('should return list of questions', async () => {
      mockPrismaService.practiceTopic.findUnique.mockResolvedValue({ id: 1 });
      mockPrismaService.practiceQuestion.findMany.mockResolvedValue([{ id: 1, questionText: 'q1' }]);
      const res = await service.listQuestions(1);
      expect(res.questions.length).toBe(1);
      expect(res.topicId).toBe(1);
    });
  });

  describe('checkPracticeQuestion', () => {
    it('should throw if topic not found', async () => {
      mockPrismaService.practiceTopic.findUnique.mockResolvedValue(null);
      await expect(service.checkPracticeQuestion(1n, 1, { questionId: 1, userAnswer: 'ans' })).rejects.toThrow(AppException);
    });

    it('should throw if question not found', async () => {
      mockPrismaService.practiceTopic.findUnique.mockResolvedValue({ id: 1 });
      mockPrismaService.practiceQuestion.findFirst.mockResolvedValue(null);
      await expect(service.checkPracticeQuestion(1n, 1, { questionId: 1, userAnswer: 'ans' })).rejects.toThrow(AppException);
    });

    it('should return correct false for wrong answer', async () => {
      mockPrismaService.practiceTopic.findUnique.mockResolvedValue({ id: 1 });
      mockPrismaService.practiceQuestion.findFirst.mockResolvedValue({ id: 1, answer: 'real_ans' });
      (quizAnswerUtil.normalizeQuizAnswer as jest.Mock)
        .mockReturnValueOnce('ans') // user
        .mockReturnValueOnce('real_ans'); // correct
      const res = await service.checkPracticeQuestion(1n, 1, { questionId: 1, userAnswer: 'ans' });
      expect(res.correct).toBe(false);
    });

    it('should return correct true and metadata for correct answer', async () => {
      mockPrismaService.practiceTopic.findUnique.mockResolvedValue({ id: 1 });
      mockPrismaService.practiceQuestion.findFirst.mockResolvedValue({ id: 1, answer: 'ans', explanation: 'exp' });
      (quizAnswerUtil.normalizeQuizAnswer as jest.Mock)
        .mockReturnValue('ans');
      const res = await service.checkPracticeQuestion(1n, 1, { questionId: 1, userAnswer: 'ans' });
      expect(res.correct).toBe(true);
      if (res.correct) {
        expect(res.correctAnswer).toBe('ans');
        expect(res.explanation).toBe('exp');
      }
    });
  });
});
