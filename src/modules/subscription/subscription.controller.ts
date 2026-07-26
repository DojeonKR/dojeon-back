import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SubscriptionService } from './subscription.service';
import { SubscribeDto } from './dto/subscribe.dto';
import { CurrentUser, JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { successExample, errorExample } from '../../common/swagger/swagger-response.helper';

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

  @ApiOperation({
    summary: '구독 신청',
    description:
      '플랜을 선택해 구독을 신청합니다. 결제 연동 전 단순 버전으로, 유료 플랜이면 `subscriptionTier`가 PREMIUM으로 바뀌고 `billingCycleMonths`만큼 만료일이 설정됩니다. 유효한 구독이 남아 있으면 만료일 이후로 기간이 연장됩니다. free 플랜 선택 시 FREE로 되돌립니다.',
  })
  @ApiResponse({
    status: 201,
    description: '구독 신청 성공',
    schema: {
      example: successExample({
        subscription: {
          planId: 'pro',
          tier: 'PREMIUM',
          expiresAt: '2026-08-26T13:00:00.000Z',
        },
      }),
    },
  })
  @ApiResponse({
    status: 404,
    description: '존재하지 않는 플랜',
    schema: { example: errorExample('존재하지 않는 구독 플랜입니다.', 404, 'PLAN_NOT_FOUND') },
  })
  @Post('subscribe')
  async subscribe(@CurrentUser() user: JwtPayloadUser, @Body() dto: SubscribeDto) {
    return this.subscriptionService.subscribe(user.userId, dto.planId);
  }
}
