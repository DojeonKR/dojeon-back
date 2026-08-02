import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { AchievementService } from '../achievement/achievement.service';
import { SECTION_EVENT_QUEUE, SectionEventJobData } from './log-event.queue';

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
        await this.achievementService.checkStatBadges(tx, userId);
      });
      return;
    }

    if (data.type === 'lesson.completed') {
      const userId = BigInt(data.userId);
      await this.handleLessonCompleted(userId, data.lessonId);
      return;
    }

    if (data.type === 'scrap.state.settled') {
      await this.settleScrapStateCount(BigInt(data.scrapId), new Date(data.stateChangedAt));
      return;
    }

    this.logger.warn(`Unknown section event job type: ${(data as { type: string }).type}`);
  }

  private async settleScrapStateCount(scrapId: bigint, stateChangedAt: Date): Promise<void> {
    const scrap = await this.prisma.scrap.findUnique({
      where: { id: scrapId },
      select: { isActive: true, countedIsActive: true },
    });
    if (!scrap || scrap.isActive === scrap.countedIsActive) return;

    await this.prisma.scrap.updateMany({
      where: {
        id: scrapId,
        isActive: scrap.isActive,
        countedIsActive: scrap.countedIsActive,
        lastStateChangedAt: stateChangedAt,
      },
      data: {
        countedIsActive: scrap.isActive,
        addCount: scrap.isActive ? { increment: 1 } : undefined,
        removeCount: scrap.isActive ? undefined : { increment: 1 },
      },
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
