import { Test, TestingModule } from '@nestjs/testing';
import { HomeService } from './home.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LearningService } from '../learning/learning.service';

describe('HomeService', () => {
  let service: HomeService;

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-02T12:00:00.000Z'));
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
                weeklyGoalMin: null,
                timezone: 'UTC',
                stats: { currentStreak: 5 },
              }),
            },
            userDailyActivity: {
              findMany: jest
                .fn()
                .mockResolvedValueOnce([
                  {
                    activityDate: new Date('2026-08-01T00:00:00.000Z'),
                    studySeconds: 420,
                    goalAchieved: true,
                  },
                  {
                    activityDate: new Date('2026-08-02T00:00:00.000Z'),
                    studySeconds: 180,
                    goalAchieved: true,
                  },
                ])
                .mockResolvedValueOnce([
                  { activityDate: new Date('2026-08-02T00:00:00.000Z') },
                  { activityDate: new Date('2026-08-01T00:00:00.000Z') },
                ]),
            },
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
      timezone: 'UTC',
      dailyStreak: 2,
      todayGoal: { targetMin: 15, studiedMin: 3 },
      weekGoal: { targetMin: 105, studiedMin: 10, isConfigured: false },
    });
    expect(result).not.toHaveProperty('userFirstName');
  });

  afterEach(() => {
    jest.useRealTimers();
  });
});
