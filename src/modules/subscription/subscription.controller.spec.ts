import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';

describe('SubscriptionController', () => {
  let controller: SubscriptionController;
  let mockSubscriptionService: any;

  beforeEach(async () => {
    mockSubscriptionService = {
      listPlans: jest.fn()
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubscriptionController],
      providers: [
        { provide: SubscriptionService, useValue: mockSubscriptionService },
      ],
    }).compile();

    controller = module.get<SubscriptionController>(SubscriptionController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should list plans', async () => {
    mockSubscriptionService.listPlans.mockResolvedValue({ plans: [] });
    const res = await controller.plans();
    expect(res).toEqual({ plans: [] });
    expect(mockSubscriptionService.listPlans).toHaveBeenCalled();
  });
});
