import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SubscriptionService } from './subscription.service';
import { successExample } from '../../common/swagger/swagger-response.helper';

@ApiTags('구독 (Subscription)')
@ApiBearerAuth('access-token')
@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @ApiOperation({
    summary: '구독 플랜 목록',
    description:
      '무료·7일 체험 후 Pro 1·3·6·12개월 순으로 반환합니다. `priceUsd`는 결제 총액, `billingCycleMonths`는 구독 기간입니다.',
  })
  @ApiResponse({
    status: 200,
    description: '구독 플랜 목록 조회 성공',
    schema: {
      example: successExample({
        plans: [
          {
            planId: 'free',
            title: 'Free Plan',
            priceText: '$0',
            subText: null,
            hasTrial: false,
            billingCycleMonths: 0,
            priceIls: null,
            priceUsd: 0,
            benefits: [],
          },
          {
            planId: 'pro',
            title: '1 Month',
            priceText: '$15',
            subText: null,
            hasTrial: false,
            billingCycleMonths: 1,
            priceIls: null,
            priceUsd: 15,
            benefits: [
              'Access to all courses classes',
              'Full access to connectivity',
              'Full access to personal notebook',
              'More coming soon',
            ],
          },
        ],
      }),
    },
  })
  @Get('plan')
  async plans() {
    return this.subscriptionService.listPlans();
  }
}
