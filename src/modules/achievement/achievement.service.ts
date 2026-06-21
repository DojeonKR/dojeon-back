import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Prisma, UserStats } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../infra/redis/redis.service';

const BADGE_HASH_KEY = 'badges:key_to_id';

const STAT_BADGE_RULES: { key: string; condition: (stats: UserStats) => boolean }[] = [
  { key: 'streak_3', condition: (s) => s.currentStreak >= 3 },
  { key: 'streak_7', condition: (s) => s.currentStreak >= 7 },
  { key: 'streak_14', condition: (s) => s.currentStreak >= 14 },
  { key: 'streak_30', condition: (s) => s.currentStreak >= 30 },
  { key: 'course_1', condition: (s) => s.totalCompletedCourses >= 1 },
  { key: 'course_2', condition: (s) => s.totalCompletedCourses >= 2 },
  { key: 'course_3', condition: (s) => s.totalCompletedCourses >= 3 },
  { key: 'course_4', condition: (s) => s.totalCompletedCourses >= 4 },
  { key: 'lesson_first', condition: (s) => s.totalCompletedLessons >= 1 },
  { key: 'lesson_5', condition: (s) => s.totalCompletedLessons >= 5 },
  { key: 'lesson_10', condition: (s) => s.totalCompletedLessons >= 10 },
  { key: 'lesson_25', condition: (s) => s.totalCompletedLessons >= 25 },
  { key: 'learned_10m', condition: (s) => s.totalStudyMin >= 10 },
  { key: 'learned_1h', condition: (s) => s.totalStudyMin >= 60 },
  { key: 'learned_5h', condition: (s) => s.totalStudyMin >= 300 },
  { key: 'learned_10h', condition: (s) => s.totalStudyMin >= 600 },
];

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
      select: { id: true, key: true },
      orderBy: { id: 'asc' },
    });

    const client = this.redis.getClient();
    const pipeline = client.pipeline();
    pipeline.del(BADGE_HASH_KEY);

    const seenKeys = new Set<string>();
    for (const row of rows) {
      if (seenKeys.has(row.key)) {
        this.logger.warn(
          `Duplicate badge key "${row.key}" (badge_id=${row.id}); Hash keeps the first id seen`,
        );
        continue;
      }
      seenKeys.add(row.key);
      pipeline.hset(BADGE_HASH_KEY, row.key, row.id.toString());
    }
    await pipeline.exec();
  }

  private async getBadgeIdByKey(key: string): Promise<number | undefined> {
    const val = await this.redis.getClient().hget(BADGE_HASH_KEY, key);
    return val ? parseInt(val, 10) : undefined;
  }

  async awardByKey(tx: Prisma.TransactionClient, userId: bigint, key: string): Promise<void> {
    const badgeId = await this.getBadgeIdByKey(key);
    if (badgeId === undefined) return;

    try {
      await tx.userBadge.create({
        data: { userId, badgeId },
      });
    } catch {
      // uk_user_badge 충돌 시 무시
    }
  }

  async checkStatBadges(tx: Prisma.TransactionClient, userId: bigint): Promise<void> {
    const stats = await tx.userStats.findUnique({ where: { userId } });
    if (!stats) return;

    const earnedIds = new Set(
      (await tx.userBadge.findMany({ where: { userId }, select: { badgeId: true } })).map(
        (b) => b.badgeId,
      ),
    );

    for (const rule of STAT_BADGE_RULES) {
      if (!rule.condition(stats)) continue;
      const badgeId = await this.getBadgeIdByKey(rule.key);
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
