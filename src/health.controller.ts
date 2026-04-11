import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from './common/decorators/public.decorator';

@ApiTags('Health')
@SkipThrottle()
@Controller()
export class HealthController {
  @Public()
  @Get('health')
  @ApiOperation({ summary: '헬스 체크 (인증 불필요)' })
  health() {
    return { status: 'ok' };
  }
}
