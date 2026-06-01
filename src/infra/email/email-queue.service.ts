import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EMAIL_QUEUE, EmailJobData } from './email.processor';

@Injectable()
export class EmailQueueService {
  constructor(@InjectQueue(EMAIL_QUEUE) private readonly emailQueue: Queue<EmailJobData>) {}

  async enqueueOtp(to: string, code: string, otpRedisKey: string): Promise<void> {
    const jobId = this.otpJobId(otpRedisKey);
    const existing = await this.emailQueue.getJob(jobId);
    if (existing) {
      await existing.remove();
    }
    await this.emailQueue.add(
      'otp',
      { type: 'otp', to, code, otpRedisKey },
      {
        jobId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    );
  }

  /** One pending OTP mail per Redis key — new send replaces the queued job. */
  private otpJobId(otpRedisKey: string): string {
    return `otp:${otpRedisKey.replace(/[^a-zA-Z0-9@._-]/g, '_')}`;
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
