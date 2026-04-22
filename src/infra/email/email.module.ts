import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EmailService } from './email.service';
import { EmailProcessor, EMAIL_QUEUE } from './email.processor';
import { EmailQueueService } from './email-queue.service';

@Global()
@Module({
  imports: [BullModule.registerQueue({ name: EMAIL_QUEUE })],
  providers: [EmailService, EmailProcessor, EmailQueueService],
  exports: [EmailService, EmailQueueService],
})
export class EmailModule {}
