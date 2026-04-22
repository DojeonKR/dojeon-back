import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EMAIL_QUEUE, EmailJobData } from './email.processor';

@Injectable()
export class EmailQueueService {
  constructor(@InjectQueue(EMAIL_QUEUE) private readonly emailQueue: Queue<EmailJobData>) {}

  async enqueueOtp(to: string, code: string): Promise<void> {
    await this.emailQueue.add('otp', { type: 'otp', to, code }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    });
  }

  async enqueueTempPassword(to: string, tempPassword: string): Promise<void> {
    await this.emailQueue.add('temp-password', { type: 'temp-password', to, tempPassword }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    });
  }
}
