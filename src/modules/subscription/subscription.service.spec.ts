import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionService } from './subscription.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let mockPrismaService: any;

  beforeEach(async () => {
    mockPrismaService = {
      subscriptionPlan: { findMany: jest.fn(), findUnique: jest.fn() },
      user: { findUnique: jest.fn(), update: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: { get: jest.fn() } },
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
          id: 'annual',
          title: '1 Year',
          priceText: '$99',
          subText: '$8.25/month',
          hasTrial: false,
          billingCycleMonths: 12,
          priceIls: null,
          priceUsd: 99,
        },
        {
          id: 'pro',
          title: '1 Month',
          priceText: '$15',
          subText: null,
          hasTrial: false,
          billingCycleMonths: 1,
          priceIls: null,
          priceUsd: 15,
        },
        {
          id: 'free',
          title: 'Free Plan',
          priceText: '$0',
          subText: null,
          hasTrial: false,
          billingCycleMonths: 0,
          priceIls: null,
          priceUsd: 0,
        },
      ]);
      const res = await service.listPlans();
      expect(res.plans.length).toBe(3);
      expect(res.plans.map((plan) => plan.planId)).toEqual(['free', 'pro', 'annual']);
      expect(res.plans[0].benefits).toEqual([]);
      expect(res.plans[0].priceIls).toBeNull();
      expect(res.plans[1].benefits).toContain('Full access to personal notebook');
      expect(res.plans[1].priceIls).toBeNull();
      expect(res.plans[1].priceUsd).toBe(15);
      expect(res.plans[2].priceUsd).toBe(99);
    });
  });

  it('blocks an unverified paid subscription mutation in production', async () => {
    const config = (service as any).configService;
    config.get.mockImplementation((key: string) => (key === 'nodeEnv' ? 'production' : false));
    mockPrismaService.subscriptionPlan.findUnique.mockResolvedValue({
      id: 'pro',
      billingCycleMonths: 1,
    });

    await expect(service.subscribe(1n, 'pro')).rejects.toThrow();
    expect(mockPrismaService.user.update).not.toHaveBeenCalled();
  });
});
