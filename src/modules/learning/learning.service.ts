import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app.exception';
import { HttpStatus } from '@nestjs/common';

@Injectable()
export class LearningService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * HOME / USER 공통: 최근 학습 섹션 기반 lastLesson 스냅샷
   */
  async getLastLessonResume(userId: bigint) {
    const lastLog = await this.prisma.userSectionLog.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        section: {
          select: {
            id: true,
            title: true,
            type: true,
            lessonId: true,
            materials: { orderBy: { sequence: 'asc' }, select: { type: true, contentText: true } },
            lesson: {
              select: {
                courseId: true,
                title: true,
                course: { select: { title: true } },
                sections: { select: { id: true } },
              },
            },
          },
        },
      },
    });
    if (!lastLog) return null;

    const s = lastLog.section;
    const grammarMat = s.materials.find((m) => m.type === 'GRAMMAR_TABLE');
    const ct = grammarMat?.contentText as { title?: string } | null;
    const grammarPreview = ct?.title ?? null;

    const lessonSectionIds = s.lesson.sections.map((sec) => sec.id);
    const totalSections = lessonSectionIds.length;
    const completedInLesson = await this.prisma.userSectionLog.count({
      where: {
        userId,
        sectionId: { in: lessonSectionIds },
        isCompleted: true,
      },
    });
    const overallProgressPercent =
      totalSections > 0 ? Math.round((completedInLesson / totalSections) * 100) : 0;

    return {
      courseId: s.lesson.courseId,
      courseTitle: s.lesson.course.title,
      lessonId: s.lessonId,
      lessonTitle: s.lesson.title,
      sectionId: s.id,
      sectionTitle: s.title,
      sectionType: s.type,
      grammarPreview,
      overallProgressPercent,
    };
  }

  async getCoursesDashboard(userId: bigint) {
    const courses = await this.prisma.course.findMany({
      orderBy: { orderNum: 'asc' },
      select: {
        id: true,
        title: true,
        description: true,
        orderNum: true,
        isActive: true,
        lessons: {
          orderBy: { orderNum: 'asc' },
          select: {
            id: true,
            title: true,
            subtitle: true,
            orderNum: true,
            sections: { select: { id: true } },
          },
        },
      },
    });

    const sectionIds = courses.flatMap((c) =>
      c.lessons.flatMap((l) => l.sections.map((s) => s.id)),
    );

    const logs = await this.prisma.userSectionLog.findMany({
      where: { userId, sectionId: { in: sectionIds } },
    });
    const logMap = new Map(logs.map((l) => [l.sectionId, l]));

    const resumeLog = await this.prisma.userSectionLog.findFirst({
      where: { userId, isCompleted: false },
      orderBy: { updatedAt: 'desc' },
      select: {
        section: {
          select: {
            id: true,
            title: true,
            type: true,
            lessonId: true,
            lesson: {
              select: {
                courseId: true,
                title: true,
                course: { select: { title: true } },
              },
            },
          },
        },
      },
    });

    let resumeBanner: {
      courseId: number;
      courseTitle: string;
      lessonId: number;
      lessonTitle: string;
      sectionId: number;
      sectionTitle: string;
      sectionType: string;
    } | null = null;

    if (resumeLog?.section) {
      const s = resumeLog.section;
      resumeBanner = {
        courseId: s.lesson.courseId,
        courseTitle: s.lesson.course.title,
        lessonId: s.lessonId,
        lessonTitle: s.lesson.title,
        sectionId: s.id,
        sectionTitle: s.title,
        sectionType: s.type,
      };
    }

    return {
      resumeBanner,
      courses: courses.map((course) => {
        if (!course.isActive) {
          return {
            courseId: course.id,
            title: course.title,
            description: course.description,
            orderNum: course.orderNum,
            isActive: course.isActive,
            totalSections: 0,
            completedSections: 0,
            overallProgressPercent: 0,
            totalStaySeconds: 0,
            lessons: [],
          };
        }

        let totalSections = 0;
        let completedSections = 0;
        let totalSeconds = 0;

        const lessons = course.lessons.map((lesson) => {
          const secCount = lesson.sections.length;
          totalSections += secCount;
          let lessonCompleted = 0;
          for (const s of lesson.sections) {
            const log = logMap.get(s.id);
            if (log?.isCompleted) {
              lessonCompleted += 1;
              completedSections += 1;
            }
            if (log) totalSeconds += log.totalStaySeconds;
          }
          const progressPercent = secCount ? Math.round((lessonCompleted / secCount) * 100) : 0;
          return {
            lessonId: lesson.id,
            title: lesson.title,
            subtitle: lesson.subtitle,
            orderNum: lesson.orderNum,
            sectionCount: secCount,
            completedSectionCount: lessonCompleted,
            progressPercent,
            isCompleted: progressPercent === 100,
          };
        });

        return {
          courseId: course.id,
          title: course.title,
          description: course.description,
          orderNum: course.orderNum,
          isActive: course.isActive,
          totalSections,
          completedSections,
          overallProgressPercent: totalSections
            ? Math.round((completedSections / totalSections) * 100)
            : 0,
          totalStaySeconds: totalSeconds,
          lessons,
        };
      }),
    };
  }

  async getLessonSections(userId: bigint, lessonId: number) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: {
        id: true,
        courseId: true,
        title: true,
        subtitle: true,
        sections: { orderBy: { orderNum: 'asc' } },
        course: {
          select: {
            lessons: { orderBy: { orderNum: 'asc' }, select: { id: true, title: true, orderNum: true } },
          },
        },
      },
    });
    if (!lesson) {
      throw new AppException('LESSON_NOT_FOUND', '레슨을 찾을 수 없습니다.', HttpStatus.NOT_FOUND);
    }

    const siblingLessons = lesson.course.lessons.map((l) => ({
      lessonId: l.id,
      title: l.title,
      orderNum: l.orderNum,
    }));

    const sectionIds = lesson.sections.map((sec) => sec.id);
    const [logs, cardGroups, materialGroups, questionGroups] = await Promise.all([
      this.prisma.userSectionLog.findMany({
        where: { userId, sectionId: { in: sectionIds } },
      }),
      this.prisma.sectionCard.groupBy({
        by: ['sectionId'],
        where: { sectionId: { in: sectionIds } },
        _count: { _all: true },
      }),
      this.prisma.sectionMaterial.groupBy({
        by: ['sectionId'],
        where: { sectionId: { in: sectionIds } },
        _count: { _all: true },
      }),
      this.prisma.sectionQuestion.groupBy({
        by: ['sectionId'],
        where: { sectionId: { in: sectionIds } },
        _count: { _all: true },
      }),
    ]);
    const logMap = new Map(logs.map((l) => [l.sectionId, l]));
    const cardCount = new Map(cardGroups.map((g) => [g.sectionId, g._count._all]));
    const materialCount = new Map(materialGroups.map((g) => [g.sectionId, g._count._all]));
    const questionCount = new Map(questionGroups.map((g) => [g.sectionId, g._count._all]));

    const hasContentFor = (s: { id: number; type: string }): boolean => {
      const c = cardCount.get(s.id) ?? 0;
      const m = materialCount.get(s.id) ?? 0;
      const q = questionCount.get(s.id) ?? 0;
      switch (s.type) {
        case 'VOCAB':
          return c > 0;
        case 'GRAMMAR':
          return m > 0;
        case 'READING':
        case 'LISTENING':
          return m > 0 || q > 0;
        case 'QUIZ':
          return q > 0;
        default:
          return m > 0 || q > 0 || c > 0;
      }
    };

    let completedCount = 0;
    const sections = lesson.sections.map((s) => {
      const log = logMap.get(s.id);
      const currentPage = log?.maxPageReached ?? 0;
      const progressPercent = s.totalPages
        ? Math.round((Math.min(currentPage, s.totalPages) / s.totalPages) * 100)
        : 0;
      if (log?.isCompleted) completedCount += 1;
      return {
        sectionId: s.id,
        type: s.type,
        title: s.title,
        totalPages: s.totalPages,
        orderNum: s.orderNum,
        currentPage,
        progressPercent,
        isCompleted: log?.isCompleted ?? false,
        hasContent: hasContentFor(s),
      };
    });

    const totalSec = lesson.sections.length;
    const overallProgressPercent = totalSec
      ? Math.round((completedCount / totalSec) * 100)
      : 0;

    return {
      courseId: lesson.courseId,
      lessonId: lesson.id,
      title: lesson.title,
      subtitle: lesson.subtitle,
      siblingLessons,
      overallProgressPercent,
      sections,
    };
  }
}
