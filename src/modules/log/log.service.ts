import { Injectable } from '@nestjs/common';
import { Prisma, ScrapType } from '@prisma/client';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app.exception';
import { HttpStatus } from '@nestjs/common';
import { SectionProgressDto } from './dto/section-progress.dto';
import { CreateScrapDto } from './dto/create-scrap.dto';
import { CheckSectionQuestionDto } from './dto/check-section-question.dto';
import { normalizeQuizAnswer } from '../../common/utils/quiz-answer.util';
import { SECTION_EVENT_QUEUE, SectionEventJobData } from './log-event.queue';
import { AchievementService } from '../achievement/achievement.service';

/** 노트북 대시보드에서 코스별로 노출하는 단어 미리보기 개수 (프론트 미리보기 카드와 동일) */
const DASHBOARD_PREVIEW_WORD_LIMIT = 5;

@Injectable()
export class LogService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(SECTION_EVENT_QUEUE)
    private readonly sectionEventQueue: Queue<SectionEventJobData>,
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
        notes: c.notes,
        locales: c.locales,
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
    const section = await this.prisma.section.findUnique({
      where: { id: sectionId },
      select: {
        id: true,
        type: true,
        difficultyEasyCount: true,
        difficultyNormalCount: true,
        difficultyHardCount: true,
      },
    });
    if (!section) {
      throw new AppException('SECTION_NOT_FOUND', '섹션을 찾을 수 없습니다.', HttpStatus.NOT_FOUND);
    }
    const [log, pageLogs] = await Promise.all([
      this.prisma.userSectionLog.findUnique({
        where: { userId_sectionId: { userId, sectionId } },
      }),
      this.prisma.userSectionPageLog.findMany({
        where: { userId, sectionId },
        orderBy: { pageNumber: 'asc' },
        select: { pageNumber: true, totalStaySeconds: true },
      }),
    ]);
    return {
      sectionId,
      currentPage: log?.maxPageReached ?? 0,
      isCompleted: log?.isCompleted ?? false,
      stayTimeSeconds: log?.totalStaySeconds ?? 0,
      difficulty: log?.difficulty ?? null,
      pageStayTimes: pageLogs.map((page) => ({
        pageNumber: page.pageNumber,
        stayTimeSeconds: page.totalStaySeconds,
      })),
      difficultyCounts:
        section.type === 'GRAMMAR'
          ? {
              easy: section.difficultyEasyCount,
              normal: section.difficultyNormalCount,
              hard: section.difficultyHardCount,
            }
          : null,
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
    if (
      dto.pageNumber !== undefined &&
      (totalPages <= 0 || dto.pageNumber >= totalPages)
    ) {
      throw new AppException(
        'INVALID_PAGE_NUMBER',
        '페이지 번호가 섹션의 페이지 범위를 벗어났습니다.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (dto.difficulty && section.type !== 'GRAMMAR') {
      throw new AppException(
        'DIFFICULTY_GRAMMAR_ONLY',
        '난이도 평가는 Grammar 섹션에만 저장할 수 있습니다.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const nextMax = Math.max(dto.currentPage, 0);
    const completed =
      dto.forceComplete === true || (totalPages > 0 && nextMax >= totalPages);

    const lessonSectionIds = section.lesson.sections.map((s) => s.id);

    const result = await this.prisma.$transaction(async (tx) => {
      const completedBefore = await tx.userSectionLog.count({
        where: {
          userId,
          sectionId: { in: lessonSectionIds },
          isCompleted: true,
        },
      });

      if (dto.difficulty) {
        await tx.$queryRaw(
          Prisma.sql`SELECT "section_id" FROM "sections" WHERE "section_id" = ${sectionId} FOR UPDATE`,
        );
      }

      const beforeLog = await tx.userSectionLog.findUnique({
        where: { userId_sectionId: { userId, sectionId } },
      });

      const isFirstEverSectionStart =
        !beforeLog && (await tx.userSectionLog.count({ where: { userId } })) === 0;

      if (dto.difficulty && !completed && !beforeLog?.isCompleted) {
        throw new AppException(
          'DIFFICULTY_REQUIRES_COMPLETION',
          'Grammar 섹션을 완료한 후 난이도를 평가할 수 있습니다.',
          HttpStatus.BAD_REQUEST,
        );
      }

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

      if (dto.pageNumber !== undefined && dto.stayTimeSeconds > 0) {
        await tx.userSectionPageLog.upsert({
          where: {
            userId_sectionId_pageNumber: {
              userId,
              sectionId,
              pageNumber: dto.pageNumber,
            },
          },
          create: {
            userId,
            sectionId,
            pageNumber: dto.pageNumber,
            totalStaySeconds: dto.stayTimeSeconds,
          },
          update: {
            totalStaySeconds: { increment: dto.stayTimeSeconds },
          },
        });
      }

      if (dto.difficulty && dto.difficulty !== beforeLog?.difficulty) {
        const counterUpdate: Prisma.SectionUpdateInput = {};
        switch (beforeLog?.difficulty) {
          case 'EASY':
            counterUpdate.difficultyEasyCount = { decrement: 1 };
            break;
          case 'NORMAL':
            counterUpdate.difficultyNormalCount = { decrement: 1 };
            break;
          case 'HARD':
            counterUpdate.difficultyHardCount = { decrement: 1 };
            break;
        }
        switch (dto.difficulty) {
          case 'EASY':
            counterUpdate.difficultyEasyCount = { increment: 1 };
            break;
          case 'NORMAL':
            counterUpdate.difficultyNormalCount = { increment: 1 };
            break;
          case 'HARD':
            counterUpdate.difficultyHardCount = { increment: 1 };
            break;
        }
        await tx.section.update({ where: { id: sectionId }, data: counterUpdate });
      }

      const addedStudyMinutes =
        Math.floor(log.totalStaySeconds / 60) -
        Math.floor((beforeLog?.totalStaySeconds ?? 0) / 60);
      if (addedStudyMinutes > 0) {
        await tx.userStats.update({
          where: { userId },
          data: {
            totalStudyMin: { increment: addedStudyMinutes },
          },
        });
      }

      const wasCompleted = beforeLog?.isCompleted ?? false;
      const nowCompleted = log.isCompleted;
      const isFirstCompletion = !wasCompleted && nowCompleted;
      const completedAfter = completedBefore + (isFirstCompletion ? 1 : 0);
      const isLessonCompleted =
        completedAfter === lessonSectionIds.length &&
        completedBefore < lessonSectionIds.length;

      if (isLessonCompleted) {
        await tx.userStats.update({
          where: { userId },
          data: { totalCompletedLessons: { increment: 1 } },
        });
      }

      if (isFirstEverSectionStart) {
        await this.achievementService.awardByKey(tx, userId, 'first_start');
      }
      await this.achievementService.checkStatBadges(tx, userId);

      const nextSection = await tx.section.findFirst({
        where: {
          lessonId: section.lessonId,
          orderNum: { gt: section.orderNum },
        },
        orderBy: { orderNum: 'asc' },
      });

      return {
        isFirstCompletion,
        isLessonCompleted,
        response: {
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
        },
      };
    });

    if (result.isFirstCompletion) {
      await this.sectionEventQueue.add(
        'section.completed',
        {
          type: 'section.completed',
          userId: userId.toString(),
          sectionId,
          lessonSectionIds,
          isFirstCompletion: result.isFirstCompletion,
          totalStaySeconds: dto.stayTimeSeconds,
        },
        { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
      );
    }

    if (result.isLessonCompleted) {
      await this.sectionEventQueue.add(
        'lesson.completed',
        {
          type: 'lesson.completed',
          userId: userId.toString(),
          lessonId: section.lessonId,
        },
        { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
      );
    }

    return result.response;
  }

  async getScrapsDashboard(userId: bigint) {
    // 3개 독립 쿼리를 Promise.all로 병렬 실행
    const [user, vocab, grammar] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.scrap.findMany({
        where: { userId, type: ScrapType.VOCAB },
        orderBy: { createdAt: 'desc' },
        // 코스별로 미리보기 개수를 채우려면 전체 상한이 코스 수만큼 여유가 있어야 한다.
        take: 50,
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
      }),
      this.prisma.scrap.findMany({
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
      }),
    ]);

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
      const group = map.get(courseId)!;
      // 노트북 메인과 Vocabulary 목록 카드가 같은 개수를 보여주도록 코스별 상한을 맞춘다.
      if (group.words.length >= DASHBOARD_PREVIEW_WORD_LIMIT) continue;
      const w = s.card?.wordFront;
      if (w) group.words.push(w);
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
        card: { select: { id: true, wordFront: true, wordBack: true, notes: true, locales: true, audioUrl: true, sequence: true } },
        section: {
          select: {
            lesson: {
              select: { courseId: true, orderNum: true, title: true, course: { select: { title: true } } },
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
          card: { select: { id: true, wordFront: true, wordBack: true, notes: true, locales: true, audioUrl: true, sequence: true } },
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
    card: {
      id: number;
      wordFront: string;
      wordBack: string;
      notes: string | null;
      locales: unknown;
      audioUrl: string | null;
      sequence: number;
    } | null;
    section: { lesson: { orderNum: number; title: string } } | null;
  }) {
    return {
      scrapId: s.id.toString(),
      sectionId: s.sectionId,
      targetType: 'VOCAB' as const,
      cardId: s.card?.id ?? null,
      // 프론트는 lessonId를 코스 내 레슨 번호(Lesson 1 칩)로 사용한다.
      lessonId: s.section?.lesson.orderNum ?? null,
      lessonTitle: s.section?.lesson.title ?? null,
      card: s.card
        ? {
            id: s.card.id,
            wordFront: s.card.wordFront,
            wordBack: s.card.wordBack,
            notes: s.card.notes,
            locales: s.card.locales,
            audioUrl: s.card.audioUrl,
            sequence: s.card.sequence,
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
