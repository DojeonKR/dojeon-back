import { Module } from '@nestjs/common';
import { PracticeController } from './practice.controller';
import { PracticeService } from './practice.service';
import { IdempotencyInterceptor } from '../../common/interceptors/idempotency.interceptor';

@Module({
  controllers: [PracticeController],
  providers: [PracticeService, IdempotencyInterceptor],
})
export class PracticeModule {}
