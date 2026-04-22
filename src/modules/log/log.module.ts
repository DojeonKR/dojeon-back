import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { LogService } from './log.service';
import { LogEventProcessor } from './log-event.processor';
import { SectionsController } from './sections.controller';
import { ScrapsController } from './scraps.controller';
import { AchievementModule } from '../achievement/achievement.module';
import { IdempotencyInterceptor } from '../../common/interceptors/idempotency.interceptor';
import { SECTION_EVENT_QUEUE } from './log-event.queue';

@Module({
  imports: [
    AchievementModule,
    BullModule.registerQueue({ name: SECTION_EVENT_QUEUE }),
  ],
  controllers: [SectionsController, ScrapsController],
  providers: [LogService, LogEventProcessor, IdempotencyInterceptor],
})
export class LogModule {}
