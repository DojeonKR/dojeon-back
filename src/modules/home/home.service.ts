import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LearningService } from '../learning/learning.service';

/** 현재 UTC 날짜가 속한 주의 월요일 00:00 UTC */
function startOfUtcWeekMonday(d: Date): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  const dow = d.getUTCDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  return new Date(Date.UTC(y, m, day + mondayOffset));
}

function endOfUtcWeekExclusive(monday: Date): Date {
  const e = new Date(monday);
  e.setUTCDate(e.getUTCDate() + 7);
  return e;
}

function utcDateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
}

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

    const weekStart = startOfUtcWeekMonday(today);
    const weekEndEx = endOfUtcWeekExclusive(weekStart);

    const weekLogsAgg = await this.prisma.userSectionLog.aggregate({
      where: {
        userId,
        updatedAt: { gte: weekStart, lt: weekEndEx },
      },
      _sum: { totalStaySeconds: true },
    });
    const weekStudiedSeconds = weekLogsAgg._sum.totalStaySeconds ?? 0;

    const weekAttendances = await this.prisma.userAttendance.findMany({
      where: {
        userId,
        attendanceDate: { gte: weekStart, lt: weekEndEx },
      },
    });
    const attendedSet = new Set(weekAttendances.map((a) => utcDateKey(a.attendanceDate)));

    const weeklyAttendance: boolean[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setUTCDate(d.getUTCDate() + i);
      weeklyAttendance.push(attendedSet.has(utcDateKey(d)));
    }

    const dailyTarget = user.dailyGoalMin ?? 0;
    const weekGoal = {
      targetMin: dailyTarget * 7,
      studiedMin: Math.floor(weekStudiedSeconds / 60),
    };

    return {
      userFirstName: user.nickname,
      dailyStreak: user.stats?.currentStreak ?? 0,
      todayGoal: {
        targetMin: dailyTarget,
        studiedMin: Math.floor(studiedSeconds / 60),
      },
      weekGoal,
      weeklyAttendance,
      lastLesson,
    };
  }
}
