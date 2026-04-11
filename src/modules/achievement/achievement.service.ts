import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AchievementService implements OnModuleInit {
  private readonly logger = new Logger(AchievementService.name);
  private badgeIdByTitle = new Map<string, number>();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.refreshBadges();
  }

  /** 배지 메타가 바뀌면 호출(운영/테스트). 기본은 기동 시 1회 로드. */
  async refreshBadges(): Promise<void> {
    const rows = await this.prisma.badge.findMany({
      select: { id: true, title: true },
      orderBy: { id: 'asc' },
    });
    const next = new Map<string, number>();
    const seenTitles = new Set<string>();
    for (const row of rows) {
      if (seenTitles.has(row.title)) {
        this.logger.warn(
          `Duplicate badge title "${row.title}" (badge_id=${row.id}); Map keeps the first id seen for this title`,
        );
        continue;
      }
      seenTitles.add(row.title);
      next.set(row.title, row.id);
    }
    this.badgeIdByTitle = next;
  }

  /**
   * 레슨/섹션 완료 후 호출. 동일 트랜잭션 내에서 실행할 것.
   */
  async checkAndAward(tx: Prisma.TransactionClient, userId: bigint): Promise<void> {
    const stats = await tx.userStats.findUnique({ where: { userId } });
    if (!stats) return;

    const earnedIds = new Set(
      (await tx.userBadge.findMany({ where: { userId }, select: { badgeId: true } })).map((b) => b.badgeId),
    );

    const rules: { title: string; condition: () => boolean }[] = [
      {
        title: '첫 발걸음',
        condition: () => stats.totalCompletedLessons >= 1,
      },
      {
        title: '7일 연속',
        condition: () => stats.currentStreak >= 7,
      },
      {
        title: '30일 연속',
        condition: () => stats.currentStreak >= 30,
      },
    ];

    for (const rule of rules) {
      if (!rule.condition()) continue;
      const badgeId = this.badgeIdByTitle.get(rule.title);
      if (badgeId === undefined || earnedIds.has(badgeId)) continue;
      try {
        await tx.userBadge.create({
          data: { userId, badgeId },
        });
        earnedIds.add(badgeId);
      } catch {
        // uk_user_badge 충돌 시 무시
      }
    }
  }
}
