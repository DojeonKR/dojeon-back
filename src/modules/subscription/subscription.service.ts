import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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
}
