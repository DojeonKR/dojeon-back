import { Injectable } from '@nestjs/common';
import { Prisma, ScrapType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app.exception';
import { HttpStatus } from '@nestjs/common';
import { SectionProgressDto } from './dto/section-progress.dto';
import { CreateScrapDto } from './dto/create-scrap.dto';
import { CheckSectionQuestionDto } from './dto/check-section-question.dto';
import { AchievementService } from '../achievement/achievement.service';
import { normalizeQuizAnswer } from '../../common/utils/quiz-answer.util';

function utcDateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

@Injectable()
export class LogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly achievementService: AchievementService,
  ) {}

  async getSectionMaterialsList(sectionId: number) {
    const section = await this.prisma.section.findUnique({
      where: { id: sectionId },
      select: {
        lessonId: true,
        lesson: { select: { courseId: true } },
      },
    });
    if (!section) {
      throw new AppException('SECTION_NOT_FOUND', '섹션을 찾을 수 없습니다.', HttpStatus.NOT_FOUND);
    }
    const materials = await this.prisma.sectionMaterial.findMany({
      where: { sectionId },
      orderBy: { sequence: 'asc' },
    });
    return { sectionId, courseId: section.lesson.courseId, lessonId: section.lessonId, materials };
  }

  async getSectionCardsList(sectionId: number, userId?: bigint) {
    const section = await this.prisma.section.findUnique({ where: { id: sectionId } });
    if (!section) {
      throw new AppException('SECTION_NOT_FOUND', '섹션을 찾을 수 없습니다.', HttpStatus.NOT_FOUND);
    }
    const cards = await this.prisma.sectionCard.findMany({
      where: { sectionId },
      orderBy: { sequence: 'asc' },
    });

    let scrapMap = new Map<number, bigint>();
    if (userId !== undefined && cards.length > 0) {
      const cardIds = cards.map((c) => c.id);
      const scraps = await this.prisma.scrap.findMany({
        where: { userId, type: ScrapType.VOCAB, cardId: { in: cardIds } },
        select: { id: true, cardId: true },
      });
      scrapMap = new Map(
        scraps.filter((s) => s.cardId != null).map((s) => [s.cardId as number, s.id]),
      );
    }

    return {
      sectionId,
      cards: cards.map((c) => ({
        id: c.id,
        wordFront: c.wordFront,
        wordBack: c.wordBack,
        audioUrl: c.audioUrl,
        sequence: c.sequence,
        isScraped: scrapMap.has(c.id),
        scrapId: scrapMap.get(c.id)?.toString() ?? null,
      })),
    };
  }

  async getSectionQuestionsList(sectionId: number) {
    const section = await this.prisma.section.findUnique({ where: { id: sectionId } });
    if (!section) {
      throw new AppException('SECTION_NOT_FOUND', '섹션을 찾을 수 없습니다.', HttpStatus.NOT_FOUND);
    }
    const questions = await this.prisma.sectionQuestion.findMany({
      where: { sectionId },
      orderBy: { id: 'asc' },
    });
    return {
      sectionId,
      questions: questions.map((q) => ({
        id: q.id,
        type: q.type,
        questionText: q.questionText,
        options: q.options,
        explanation: q.explanation,
      })),
    };
  }

  async getSectionProgressForUser(userId: bigint, sectionId: number) {
    const section = await this.prisma.section.findUnique({ where: { id: sectionId } });
    if (!section) {
      throw new AppException('SECTION_NOT_FOUND', '섹션을 찾을 수 없습니다.', HttpStatus.NOT_FOUND);
    }
    const log = await this.prisma.userSectionLog.findUnique({
      where: { userId_sectionId: { userId, sectionId } },
    });
    return {
      sectionId,
      currentPage: log?.maxPageReached ?? 0,
      isCompleted: log?.isCompleted ?? false,
      stayTimeSeconds: log?.totalStaySeconds ?? 0,
    };
  }

  /** 정책 A: 정답일 때만 correctAnswer·explanation 포함 */
  async checkSectionQuestion(
    userId: bigint,
    sectionId: number,
    dto: CheckSectionQuestionDto,
  ): Promise<
    | { correct: false }
    | { correct: true; correctAnswer: string; explanation: string | null }
  > {
    void userId;
    const section = await this.prisma.section.findUnique({ where: { id: sectionId } });
    if (!section) {
      throw new AppException('SECTION_NOT_FOUND', '섹션을 찾을 수 없습니다.', HttpStatus.NOT_FOUND);
    }
    const q = await this.prisma.sectionQuestion.findFirst({
      where: { id: dto.questionId, sectionId },
    });
    if (!q) {
      throw new AppException('QUESTION_NOT_FOUND', '문제를 찾을 수 없습니다.', HttpStatus.NOT_FOUND);
    }
    const correct =
      normalizeQuizAnswer(dto.userAnswer) === normalizeQuizAnswer(q.answer);
    if (!correct) {
      return { correct: false };
    }
    return {
      correct: true,
      correctAnswer: q.answer,
      explanation: q.explanation ?? null,
    };
  }

  async saveSectionProgress(userId: bigint, sectionId: number, dto: SectionProgressDto) {
    const section = await this.prisma.section.findUnique({
      where: { id: sectionId },
      include: {
        lesson: {
          include: { sections: { select: { id: true, orderNum: true, title: true, type: true } } },
        },
      },
    });
    if (!section) {
      throw new AppException('SECTION_NOT_FOUND', '섹션을 찾을 수 없습니다.', HttpStatus.NOT_FOUND);
    }

    const totalPages = section.totalPages;
    const nextMax = Math.max(dto.currentPage, 0);
    const completed =
      dto.forceComplete === true || (totalPages > 0 && nextMax >= totalPages);

    const lessonSectionIds = section.lesson.sections.map((s) => s.id);

    return this.prisma.$transaction(async (tx) => {
      const completedBefore = await tx.userSectionLog.count({
        where: {
          userId,
          sectionId: { in: lessonSectionIds },
          isCompleted: true,
        },
      });

      const beforeLog = await tx.userSectionLog.findUnique({
        where: { userId_sectionId: { userId, sectionId } },
      });

      const log = await tx.userSectionLog.upsert({
        where: { userId_sectionId: { userId, sectionId } },
        create: {
          userId,
          sectionId,
          maxPageReached: nextMax,
          totalStaySeconds: dto.stayTimeSeconds,
          isCompleted: completed,
          difficulty: dto.difficulty ?? null,
        },
        update: {
          maxPageReached: Math.max(beforeLog?.maxPageReached ?? 0, nextMax),
          totalStaySeconds: { increment: dto.stayTimeSeconds },
          isCompleted: completed || (beforeLog?.isCompleted ?? false),
          difficulty: dto.difficulty ?? beforeLog?.difficulty ?? undefined,
        },
      });

      const completedAfter = await tx.userSectionLog.count({
        where: {
          userId,
          sectionId: { in: lessonSectionIds },
          isCompleted: true,
        },
      });

      const totalLessonSections = lessonSectionIds.length;
      if (
        completedAfter === totalLessonSections &&
        completedBefore < totalLessonSections
      ) {
        await tx.userStats.update({
          where: { userId },
          data: { totalCompletedLessons: { increment: 1 } },
        });
      }

      if (dto.stayTimeSeconds > 0) {
        await tx.userStats.update({
          where: { userId },
          data: {
            totalStudyMin: { increment: Math.floor(dto.stayTimeSeconds / 60) },
          },
        });
      }

      if (log.isCompleted) {
        const today = utcDateOnly(new Date());
        await tx.userAttendance.upsert({
          where: {
            userId_attendanceDate: { userId, attendanceDate: today },
          },
          create: { userId, attendanceDate: today },
          update: {},
        });
        await this.recalculateStreak(tx, userId);
      }

      await this.achievementService.checkAndAward(tx, userId);

      const nextSection = await tx.section.findFirst({
        where: {
          lessonId: section.lessonId,
          orderNum: { gt: section.orderNum },
        },
        orderBy: { orderNum: 'asc' },
      });

      return {
        sectionId,
        log: {
          currentPage: log.maxPageReached,
          stayTimeSeconds: log.totalStaySeconds,
          isCompleted: log.isCompleted,
          difficulty: log.difficulty,
        },
        nextSection: nextSection
          ? {
              courseId: section.lesson.courseId,
              lessonId: section.lessonId,
              sectionId: nextSection.id,
              type: nextSection.type,
              title: nextSection.title,
            }
          : null,
      };
    });
  }

  private async recalculateStreak(tx: Prisma.TransactionClient, userId: bigint): Promise<void> {
    const stats = await tx.userStats.findUnique({ where: { userId } });
    if (!stats) return;

    // 최근 출석 날짜를 내림차순으로 가져와 연속 일수를 단일 쿼리로 계산
    const rows = await tx.userAttendance.findMany({
      where: { userId },
      orderBy: { attendanceDate: 'desc' },
      select: { attendanceDate: true },
    });

    let streak = 0;
    let expected = utcDateOnly(new Date());
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
      data: { currentStreak: streak, maxStreak },
    });
  }

  async getScrapsDashboard(userId: bigint) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const vocab = await this.prisma.scrap.findMany({
      where: { userId, type: ScrapType.VOCAB },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        card: { select: { wordFront: true } },
        section: {
          select: {
            lesson: {
              select: { courseId: true, course: { select: { title: true } } },
            },
          },
        },
      },
    });
    const grammar = await this.prisma.scrap.findMany({
      where: { userId, type: ScrapType.GRAMMAR },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        material: { select: { contentText: true } },
        section: {
          select: {
            lesson: {
              select: {
                title: true,
                course: { select: { title: true } },
              },
            },
          },
        },
      },
    });

    const vocabularyPreview = this.groupVocabForDashboard(vocab);
    const grammarPreview = grammar.map((g) => ({
      scrapId: g.id.toString(),
      courseTitle: g.section?.lesson.course.title ?? '',
      lessonTitle: g.section?.lesson.title ?? '',
      grammarPoint: this.grammarTitleFromMaterial(g.material),
    }));

    return {
      userName: user?.nickname ?? '',
      vocabularyPreview,
      grammarPreview,
    };
  }

  private groupVocabForDashboard(
    scraps: Array<{
      id: bigint;
      card: { wordFront: string } | null;
      section: { lesson: { courseId: number; course: { title: string } } } | null;
    }>,
  ) {
    const map = new Map<number, { courseId: number; courseTitle: string; words: string[] }>();
    for (const s of scraps) {
      const courseId = s.section?.lesson.courseId ?? 0;
      const courseTitle = s.section?.lesson.course.title ?? '기타';
      if (!map.has(courseId)) {
        map.set(courseId, { courseId, courseTitle, words: [] });
      }
      const w = s.card?.wordFront;
      if (w) map.get(courseId)!.words.push(w);
    }
    return { groups: Array.from(map.values()) };
  }

  private grammarTitleFromMaterial(material: { contentText: unknown } | null): string {
    if (!material) return '';
    const ct = material.contentText as { title?: string };
    return ct?.title ?? '';
  }

  async listScraps(userId: bigint, type: ScrapType, sort: string, cursor?: string, limit = 20) {
    void sort;
    if (type === ScrapType.VOCAB) {
      return this.listVocabGrouped(userId, cursor, limit);
    }
    return this.listGrammarFlat(userId, cursor, limit);
  }

  async listVocabGrouped(userId: bigint, cursor?: string, limit = 20) {
    const take = limit + 1;
    const scraps = await this.prisma.scrap.findMany({
      where: {
        userId,
        type: ScrapType.VOCAB,
        ...(cursor ? { id: { lt: BigInt(cursor) } } : {}),
      },
      orderBy: { id: 'desc' },
      take,
      select: {
        id: true,
        sectionId: true,
        createdAt: true,
        card: { select: { id: true, wordFront: true, wordBack: true, audioUrl: true } },
        section: {
          select: {
            lesson: {
              select: { courseId: true, course: { select: { title: true } } },
            },
          },
        },
      },
    });

    const hasNext = scraps.length > limit;
    const items = hasNext ? scraps.slice(0, limit) : scraps;
    const nextCursor = hasNext ? items[items.length - 1].id.toString() : null;

    type Item = ReturnType<LogService['mapScrapVocab']>;
    const map = new Map<number, { courseId: number; courseTitle: string; items: Item[] }>();
    for (const s of items) {
      const courseId = s.section?.lesson.courseId ?? 0;
      const courseTitle = s.section?.lesson.course.title ?? '기타';
      if (!map.has(courseId)) {
        map.set(courseId, { courseId, courseTitle, items: [] });
      }
      map.get(courseId)!.items.push(this.mapScrapVocab(s));
    }
    return { targetType: 'VOCAB', groups: Array.from(map.values()), nextCursor };
  }

  async listGrammarFlat(userId: bigint, cursor?: string, limit = 20) {
    const take = limit + 1;
    const scraps = await this.prisma.scrap.findMany({
      where: {
        userId,
        type: ScrapType.GRAMMAR,
        ...(cursor ? { id: { lt: BigInt(cursor) } } : {}),
      },
      orderBy: { id: 'desc' },
      take,
      select: {
        id: true,
        sectionId: true,
        createdAt: true,
        material: { select: { id: true, contentText: true, type: true } },
        section: {
          select: {
            lesson: {
              select: { title: true, course: { select: { title: true } } },
            },
          },
        },
      },
    });

    const hasNext = scraps.length > limit;
    const items = hasNext ? scraps.slice(0, limit) : scraps;
    const nextCursor = hasNext ? items[items.length - 1].id.toString() : null;

    return {
      targetType: 'GRAMMAR',
      items: items.map((s) => this.mapScrapGrammar(s)),
      nextCursor,
    };
  }

  async createScrap(userId: bigint, dto: CreateScrapDto) {
    if (dto.type === ScrapType.VOCAB) {
      if (dto.cardId == null) {
        throw new AppException('INVALID_SCRAP', 'VOCAB 타입에는 cardId가 필요합니다.', HttpStatus.BAD_REQUEST);
      }
      const card = await this.prisma.sectionCard.findUnique({ where: { id: dto.cardId } });
      if (!card) {
        throw new AppException('CARD_NOT_FOUND', '카드를 찾을 수 없습니다.', HttpStatus.NOT_FOUND);
      }
      return this.prisma.scrap.create({
        data: {
          userId,
          sectionId: dto.sectionId ?? card.sectionId,
          type: ScrapType.VOCAB,
          cardId: dto.cardId,
          materialId: null,
        },
        select: {
          id: true,
          sectionId: true,
          type: true,
          cardId: true,
          materialId: true,
          createdAt: true,
          card: { select: { id: true, wordFront: true, wordBack: true, audioUrl: true, sequence: true } },
        },
      });
    }

    if (dto.materialId == null) {
      throw new AppException('INVALID_SCRAP', 'GRAMMAR 타입에는 materialId가 필요합니다.', HttpStatus.BAD_REQUEST);
    }
    const mat = await this.prisma.sectionMaterial.findUnique({ where: { id: dto.materialId } });
    if (!mat) {
      throw new AppException('MATERIAL_NOT_FOUND', '머티리얼을 찾을 수 없습니다.', HttpStatus.NOT_FOUND);
    }
    return this.prisma.scrap.create({
      data: {
        userId,
        sectionId: dto.sectionId ?? mat.sectionId,
        type: ScrapType.GRAMMAR,
        cardId: null,
        materialId: dto.materialId,
      },
      select: {
        id: true,
        sectionId: true,
        type: true,
        cardId: true,
        materialId: true,
        createdAt: true,
        material: {
          select: {
            id: true,
            type: true,
            sequence: true,
            contentText: true,
          },
        },
      },
    });
  }

  async deleteScrap(userId: bigint, scrapId: bigint) {
    const scrap = await this.prisma.scrap.findUnique({ where: { id: scrapId } });
    if (!scrap || scrap.userId !== userId) {
      throw new AppException('SCRAP_NOT_FOUND', '스크랩을 찾을 수 없습니다.', HttpStatus.NOT_FOUND);
    }
    await this.prisma.scrap.delete({ where: { id: scrapId } });
    return { deleted: true };
  }

  private mapScrapVocab(s: {
    id: bigint;
    sectionId: number | null;
    createdAt: Date;
    card: { id: number; wordFront: string; wordBack: string; audioUrl: string | null } | null;
  }) {
    return {
      scrapId: s.id.toString(),
      sectionId: s.sectionId,
      targetType: 'VOCAB' as const,
      content: s.card
        ? {
            cardId: s.card.id,
            front: s.card.wordFront,
            back: s.card.wordBack,
            audioUrl: s.card.audioUrl,
          }
        : null,
      createdAt: s.createdAt,
    };
  }

  private mapScrapGrammar(s: {
    id: bigint;
    sectionId: number | null;
    createdAt: Date;
    material: { id: number; contentText: unknown; type: string } | null;
    section: { lesson: { course: { title: string }; title: string } } | null;
  }) {
    const ct = s.material?.contentText as { title?: string } | undefined;
    return {
      scrapId: s.id.toString(),
      sectionId: s.sectionId,
      targetType: 'GRAMMAR' as const,
      courseTitle: s.section?.lesson.course.title ?? '',
      lessonTitle: s.section?.lesson.title ?? '',
      grammarPoint: ct?.title ?? '',
      createdAt: s.createdAt,
    };
  }
}
