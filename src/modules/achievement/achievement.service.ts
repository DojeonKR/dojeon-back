import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Injectable()
export class AchievementService {
  /**
   * 레슨/섹션 완료 후 호출. 동일 트랜잭션 내에서 실행할 것.
   */
  async checkAndAward(tx: Prisma.TransactionClient, userId: bigint): Promise<void> {
    const stats = await tx.userStats.findUnique({ where: { userId } });
    if (!stats) return;

    const badges = await tx.badge.findMany();
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
      const badge = badges.find((b) => b.title === rule.title);
      if (!badge || earnedIds.has(badge.id)) continue;
      try {
        await tx.userBadge.create({
          data: { userId, badgeId: badge.id },
        });
        earnedIds.add(badge.id);
      } catch {
        // uk_user_badge 충돌 시 무시
      }
    }
  }
}
