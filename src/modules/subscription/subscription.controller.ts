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
      'DB `subscription_plan`의 `planId`·표시 필드 + 서버 하드코딩 `benefits` 맵(`free`·`basic`·`pro`·`annual`)을 합쳐 반환합니다. 플랜 id가 맵에 없으면 `benefits`는 빈 배열입니다. `title`·`priceText` 등은 DB 시드 값과 일치해야 합니다.',
  })
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
            benefits: ['기본 레슨', '광고 포함'],
          },
          {
            planId: 'pro',
            title: '프리미엄',
            priceText: '₩9,900 / 월',
            subText: '첫 달 무료',
            hasTrial: true,
            billingCycleMonths: 1,
            benefits: ['전체 레슨', 'AI 분석', '우선 지원'],
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
