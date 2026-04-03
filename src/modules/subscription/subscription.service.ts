import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const BENEFITS_BY_PLAN: Record<string, string[]> = {
  free: ['기본 레슨', '광고 포함'],
  basic: ['전체 레슨', '오프라인 다운로드'],
  pro: ['전체 레슨', 'AI 분석', '우선 지원'],
  annual: ['Pro와 동일', '연간 할인'],
};

@Injectable()
export class SubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

  async listPlans() {
    const rows = await this.prisma.subscriptionPlan.findMany({
      orderBy: { id: 'asc' },
    });
    return {
      plans: rows.map((p) => ({
        planId: p.id,
        title: p.title,
        priceText: p.priceText,
        subText: p.subText,
        hasTrial: p.hasTrial,
        billingCycleMonths: p.billingCycleMonths,
        benefits: BENEFITS_BY_PLAN[p.id] ?? [],
      })),
    };
  }
}
