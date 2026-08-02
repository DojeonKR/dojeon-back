import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LearningService } from '../learning/learning.service';
import {
  addDaysToDateKey,
  currentGoalStreakFromDates,
  dateKeyToUtcDate,
  localDateKey,
  startOfIsoWeekDateKey,
} from '../../common/utils/local-date.util';

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
    if (!user) return null;

    const now = new Date();
    const timezone = user.timezone;
    const todayKey = localDateKey(now, timezone);
    const todayDate = dateKeyToUtcDate(todayKey);
    const weekStartKey = startOfIsoWeekDateKey(todayKey);
    const weekStart = dateKeyToUtcDate(weekStartKey);
    const weekEnd = dateKeyToUtcDate(addDaysToDateKey(weekStartKey, 7));

    const [weekActivities, streakActivities, lastLesson] = await Promise.all([
      this.prisma.userDailyActivity.findMany({
        where: { userId, activityDate: { gte: weekStart, lt: weekEnd } },
        orderBy: { activityDate: 'asc' },
      }),
      this.prisma.userDailyActivity.findMany({
        where: { userId, goalAchieved: true, activityDate: { lte: todayDate } },
        orderBy: { activityDate: 'desc' },
        select: { activityDate: true },
        take: 366,
      }),
      this.learningService.getLastLessonResume(userId),
    ]);

    const todayActivity = weekActivities.find(
      (activity) => activity.activityDate.toISOString().slice(0, 10) === todayKey,
    );
    const studiedSeconds = todayActivity?.studySeconds ?? 0;
    const weekStudiedSeconds = weekActivities.reduce(
      (sum, activity) => sum + activity.studySeconds,
      0,
    );
    const achievedSet = new Set(
      weekActivities
        .filter((activity) => activity.goalAchieved)
        .map((activity) => activity.activityDate.toISOString().slice(0, 10)),
    );

    const weeklyAttendance = Array.from({ length: 7 }, (_, index) =>
      achievedSet.has(addDaysToDateKey(weekStartKey, index)),
    );
    const dailyTarget = user.dailyGoalMin ?? 0;

    return {
      nickname: user.nickname,
      timezone,
      dailyStreak: currentGoalStreakFromDates(
        streakActivities.map((activity) => activity.activityDate),
        todayKey,
      ),
      todayGoal: {
        targetMin: dailyTarget,
        studiedMin: Math.floor(studiedSeconds / 60),
      },
      weekGoal: {
        // Keep the legacy derived target until the frontend supports an unset weekly goal.
        targetMin: user.weeklyGoalMin ?? dailyTarget * 7,
        studiedMin: Math.floor(weekStudiedSeconds / 60),
        isConfigured: user.weeklyGoalMin !== null,
      },
      weeklyAttendance,
      lastLesson,
    };
  }
}
