import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SubscriptionService } from './subscription.service';
import { successExample } from '../../common/swagger/swagger-response.helper';

@ApiTags('구독 (Subscription)')
@ApiBearerAuth('access-token')
@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @ApiOperation({ summary: '구독 플랜 목록', description: '무료·유료 구독 플랜과 각 플랜의 혜택을 반환합니다.' })
  @ApiResponse({
    status: 200,
    description: '구독 플랜 목록 조회 성공',
    schema: {
      example: successExample({
        plans: [
          {
            planId: 'free',
            title: '무료',
            priceText: '₩0 / 월',
            subText: null,
            hasTrial: false,
            billingCycleMonths: 1,
            benefits: ['기초 코스 1개 무료', '하루 3섹션 학습'],
          },
          {
            planId: 'pro',
            title: '프리미엄',
            priceText: '₩9,900 / 월',
            subText: '첫 달 무료',
            hasTrial: true,
            billingCycleMonths: 1,
            benefits: ['모든 코스 무제한', '무제한 스크랩', '오프라인 다운로드'],
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
