import { Test, TestingModule } from '@nestjs/testing';
import { HomeService } from './home.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LearningService } from '../learning/learning.service';

describe('HomeService', () => {
  let service: HomeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HomeService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn().mockResolvedValue({
                nickname: 'Lior',
                dailyGoalMin: 15,
                stats: { currentStreak: 5 },
              }),
            },
            userSectionLog: {
              aggregate: jest
                .fn()
                .mockResolvedValueOnce({ _sum: { totalStaySeconds: 180 } })
                .mockResolvedValueOnce({ _sum: { totalStaySeconds: 600 } }),
            },
            userAttendance: { findMany: jest.fn().mockResolvedValue([]) },
          },
        },
        {
          provide: LearningService,
          useValue: { getLastLessonResume: jest.fn().mockResolvedValue(null) },
        },
      ],
    }).compile();

    service = module.get(HomeService);
  });

  it('returns the nickname used by the home welcome message', async () => {
    const result = await service.getResume(1n);

    expect(result).toMatchObject({
      nickname: 'Lior',
      dailyStreak: 5,
      todayGoal: { targetMin: 15, studiedMin: 3 },
      weekGoal: { targetMin: 105, studiedMin: 10 },
    });
    expect(result).not.toHaveProperty('userFirstName');
  });
});
