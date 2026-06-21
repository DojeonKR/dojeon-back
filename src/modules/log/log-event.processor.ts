import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AchievementService } from '../achievement/achievement.service';
import { SECTION_EVENT_QUEUE, SectionEventJobData } from './log-event.queue';

function utcDateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * BullMQ 기반 섹션/레슨 이벤트 프로세서.
 * EventEmitter2 리스너를 대체하여 실패 시 자동 재시도(attempts: 3)와 DLQ 보관을 보장한다.
 */
@Processor(SECTION_EVENT_QUEUE)
export class LogEventProcessor extends WorkerHost {
  private readonly logger = new Logger(LogEventProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly achievementService: AchievementService,
  ) {
    super();
  }

  async process(job: Job<SectionEventJobData>): Promise<void> {
    const { data } = job;

    if (data.type === 'section.completed') {
      const userId = BigInt(data.userId);
      await this.prisma.$transaction(async (tx) => {
        await this.recordAttendanceAndStreak(tx, userId);
        await this.achievementService.checkStatBadges(tx, userId);
      });
      return;
    }

    if (data.type === 'lesson.completed') {
      const userId = BigInt(data.userId);
      await this.handleLessonCompleted(userId, data.lessonId);
      return;
    }

    this.logger.warn(`Unknown section event job type: ${(data as { type: string }).type}`);
  }

  private async recordAttendanceAndStreak(
    tx: Prisma.TransactionClient,
    userId: bigint,
  ): Promise<void> {
    const today = utcDateOnly(new Date());
    const existingAtt = await tx.userAttendance.findUnique({
      where: { userId_attendanceDate: { userId, attendanceDate: today } },
    });

    if (!existingAtt) {
      await tx.userAttendance.create({ data: { userId, attendanceDate: today } });
      await this.recalculateStreak(tx, userId);
    }
  }

  private async recalculateStreak(
    tx: Prisma.TransactionClient,
    userId: bigint,
  ): Promise<void> {
    const stats = await tx.userStats.findUnique({ where: { userId } });
    if (!stats) return;

    const today = utcDateOnly(new Date());

    if (stats.lastAttendanceDate) {
      const lastDate = utcDateOnly(stats.lastAttendanceDate);
      if (lastDate.getTime() === today.getTime()) return;

      const yesterday = new Date(today);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const isConsecutive = lastDate.getTime() === yesterday.getTime();
      const newStreak = isConsecutive ? stats.currentStreak + 1 : 1;
      const maxStreak = Math.max(stats.maxStreak, newStreak);
      await tx.userStats.update({
        where: { userId },
        data: { currentStreak: newStreak, maxStreak, lastAttendanceDate: today },
      });
      return;
    }

    const rows = await tx.userAttendance.findMany({
      where: { userId },
      orderBy: { attendanceDate: 'desc' },
      select: { attendanceDate: true },
      take: 366,
    });

    let streak = 0;
    let expected = today;
    for (const row of rows) {
      const d = utcDateOnly(row.attendanceDate);
      if (d.getTime() !== expected.getTime()) break;
      streak += 1;
      const prev = new Date(expected);
      prev.setUTCDate(prev.getUTCDate() - 1);
      expected = prev;
    }

    const maxStreak = Math.max(stats.maxStreak, streak);
    await tx.userStats.update({
      where: { userId },
      data: { currentStreak: streak, maxStreak, lastAttendanceDate: today },
    });
  }

  private async handleLessonCompleted(userId: bigint, lessonId: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const lesson = await tx.lesson.findUnique({
        where: { id: lessonId },
        select: { courseId: true },
      });
      if (!lesson) return;

      const course = await tx.course.findUnique({
        where: { id: lesson.courseId },
        include: {
          lessons: {
            include: { sections: { select: { id: true } } },
          },
        },
      });
      if (!course) return;

      const allSectionIds = course.lessons.flatMap((l) => l.sections.map((s) => s.id));
      if (allSectionIds.length === 0) return;

      const completedCount = await tx.userSectionLog.count({
        where: {
          userId,
          sectionId: { in: allSectionIds },
          isCompleted: true,
        },
      });
      if (completedCount < allSectionIds.length) return;

      const existing = await tx.userCourseCompletion.findUnique({
        where: { userId_courseId: { userId, courseId: lesson.courseId } },
      });
      if (existing) return;

      await tx.userCourseCompletion.create({
        data: { userId, courseId: lesson.courseId },
      });
      await tx.userStats.update({
        where: { userId },
        data: { totalCompletedCourses: { increment: 1 } },
      });
      await this.achievementService.checkStatBadges(tx, userId);
    });
  }
}
