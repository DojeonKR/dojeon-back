import { Module } from '@nestjs/common';
import { LogService } from './log.service';
import { SectionsController } from './sections.controller';
import { ScrapsController } from './scraps.controller';
import { AchievementModule } from '../achievement/achievement.module';
import { IdempotencyInterceptor } from '../../common/interceptors/idempotency.interceptor';

@Module({
  imports: [AchievementModule],
  controllers: [SectionsController, ScrapsController],
  providers: [LogService, IdempotencyInterceptor],
})
export class LogModule {}
