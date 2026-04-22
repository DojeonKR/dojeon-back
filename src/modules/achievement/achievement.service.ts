import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../infra/redis/redis.service';

const BADGE_HASH_KEY = 'badges:title_to_id';

@Injectable()
export class AchievementService implements OnModuleInit {
  private readonly logger = new Logger(AchievementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.refreshBadges();
  }

  /** DB에서 배지 목록을 읽어 Redis Hash에 동기화. 모든 인스턴스가 공유. */
  async refreshBadges(): Promise<void> {
    const rows = await this.prisma.badge.findMany({
      select: { id: true, title: true },
      orderBy: { id: 'asc' },
    });

    const client = this.redis.getClient();
    const pipeline = client.pipeline();
    pipeline.del(BADGE_HASH_KEY);

    const seenTitles = new Set<string>();
    for (const row of rows) {
      if (seenTitles.has(row.title)) {
        this.logger.warn(
          `Duplicate badge title "${row.title}" (badge_id=${row.id}); Hash keeps the first id seen`,
        );
        continue;
      }
      seenTitles.add(row.title);
      pipeline.hset(BADGE_HASH_KEY, row.title, row.id.toString());
    }
    await pipeline.exec();
  }

  private async getBadgeIdByTitle(title: string): Promise<number | undefined> {
    const val = await this.redis.getClient().hget(BADGE_HASH_KEY, title);
    return val ? parseInt(val, 10) : undefined;
  }

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
      const badgeId = await this.getBadgeIdByTitle(rule.title);
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
