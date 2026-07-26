import { HttpStatus, Injectable } from '@nestjs/common';
import { SubscriptionTier } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app.exception';

const BENEFITS_BY_PLAN: Record<string, string[]> = {
  free: [],
  basic: [],
  pro: [
    'Access to all courses classes',
    'Full access to connectivity',
    'Full access to personal notebook',
    'More coming soon',
  ],
  'pro-3month': [
    'Access to all courses classes',
    'Full access to connectivity',
    'Full access to personal notebook',
    'More coming soon',
  ],
  'pro-6month': [
    'Access to all courses classes',
    'Full access to connectivity',
    'Full access to personal notebook',
    'More coming soon',
  ],
  annual: [
    'Access to all courses classes',
    'Full access to connectivity',
    'Full access to personal notebook',
    'More coming soon',
  ],
};

const PLAN_ORDER = ['free', 'basic', 'pro', 'pro-3month', 'pro-6month', 'annual'];

@Injectable()
export class SubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

  async listPlans() {
    const rows = await this.prisma.subscriptionPlan.findMany();
    return {
      plans: rows
        .sort((a, b) => {
          const aOrder = PLAN_ORDER.indexOf(a.id);
          const bOrder = PLAN_ORDER.indexOf(b.id);
          return (
            (aOrder === -1 ? Number.MAX_SAFE_INTEGER : aOrder) -
              (bOrder === -1 ? Number.MAX_SAFE_INTEGER : bOrder) || a.id.localeCompare(b.id)
          );
        })
        .map((p) => ({
          planId: p.id,
          title: p.title,
          priceText: p.priceText,
          subText: p.subText,
          hasTrial: p.hasTrial,
          billingCycleMonths: p.billingCycleMonths,
          priceIls: p.priceIls,
          priceUsd: p.priceUsd,
          benefits: BENEFITS_BY_PLAN[p.id] ?? [],
        })),
    };
  }

  async subscribe(userId: bigint, planId: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) {
      throw new AppException(
        'PLAN_NOT_FOUND',
        '존재하지 않는 구독 플랜입니다.',
        HttpStatus.NOT_FOUND,
      );
    }

    const isFree = plan.billingCycleMonths === 0;
    const tier: SubscriptionTier = isFree ? SubscriptionTier.FREE : SubscriptionTier.PREMIUM;

    let expiresAt: Date | null = null;
    if (!isFree) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { subscriptionExpiresAt: true },
      });
      const now = new Date();
      // 유효한 구독이 남아 있으면 만료일 이후로 기간을 이어 붙인다.
      const base =
        user?.subscriptionExpiresAt && user.subscriptionExpiresAt > now
          ? user.subscriptionExpiresAt
          : now;
      expiresAt = new Date(base);
      expiresAt.setUTCMonth(expiresAt.getUTCMonth() + plan.billingCycleMonths);
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionTier: tier,
        subscriptionPlanId: isFree ? null : plan.id,
        subscriptionExpiresAt: expiresAt,
      },
      select: {
        subscriptionTier: true,
        subscriptionPlanId: true,
        subscriptionExpiresAt: true,
      },
    });

    return {
      subscription: {
        planId: updated.subscriptionPlanId,
        tier: updated.subscriptionTier,
        expiresAt: updated.subscriptionExpiresAt?.toISOString() ?? null,
      },
    };
  }
}
