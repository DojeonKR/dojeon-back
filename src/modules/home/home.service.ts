import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LearningService } from '../learning/learning.service';

@Injectable()
export class HomeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly learningService: LearningService,
  ) {}

  async getResume(userId: bigint) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { stats: true },
    });
    if (!user) {
      return null;
    }

    const today = new Date();
    const startOfDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const endOfDay = new Date(startOfDay);
    endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

    const todayLogs = await this.prisma.userSectionLog.findMany({
      where: {
        userId,
        updatedAt: { gte: startOfDay, lt: endOfDay },
      },
    });
    const studiedSeconds = todayLogs.reduce((acc, l) => acc + l.totalStaySeconds, 0);

    const lastLesson = await this.learningService.getLastLessonResume(userId);

    return {
      userFirstName: user.nickname,
      dailyStreak: user.stats?.currentStreak ?? 0,
      todayGoal: {
        targetMin: user.dailyGoalMin ?? 0,
        studiedMin: Math.floor(studiedSeconds / 60),
      },
      lastLesson,
    };
  }
}
