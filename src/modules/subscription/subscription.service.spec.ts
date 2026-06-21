import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionService } from './subscription.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let mockPrismaService: any;

  beforeEach(async () => {
    mockPrismaService = {
      subscriptionPlan: { findMany: jest.fn() }
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<SubscriptionService>(SubscriptionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('listPlans', () => {
    it('should return subscription plans with benefits', async () => {
      mockPrismaService.subscriptionPlan.findMany.mockResolvedValue([
        {
          id: 'free',
          title: 'Free Plan',
          priceText: '$0',
          subText: null,
          hasTrial: false,
          billingCycleMonths: 0,
          priceIls: null,
          priceUsd: null,
        },
        {
          id: 'pro',
          title: 'Pro Plan',
          priceText: '$10',
          subText: null,
          hasTrial: true,
          billingCycleMonths: 1,
          priceIls: 50,
          priceUsd: 15,
        },
        {
          id: 'unknown',
          title: 'Unknown Plan',
          priceText: '$99',
          subText: null,
          hasTrial: false,
          billingCycleMonths: 1,
          priceIls: null,
          priceUsd: null,
        },
      ]);
      const res = await service.listPlans();
      expect(res.plans.length).toBe(3);
      expect(res.plans[0].benefits).toEqual(['기본 레슨', '광고 포함']);
      expect(res.plans[0].priceIls).toBeNull();
      expect(res.plans[1].benefits).toContain('AI 분석');
      expect(res.plans[1].priceIls).toBe(50);
      expect(res.plans[1].priceUsd).toBe(15);
      expect(res.plans[2].benefits).toEqual([]);
    });
  });
});
