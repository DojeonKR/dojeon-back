import { createHash } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EMAIL_QUEUE, EmailJobData } from './email.processor';

@Injectable()
export class EmailQueueService {
  private readonly logger = new Logger(EmailQueueService.name);

  constructor(@InjectQueue(EMAIL_QUEUE) private readonly emailQueue: Queue<EmailJobData>) {}

  async enqueueOtp(to: string, code: string, otpRedisKey: string): Promise<void> {
    const jobId = this.otpJobId(otpRedisKey);
    await this.removeOtpJob(jobId);

    const opts = {
      jobId,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: true,
      removeOnFail: 100,
    } as const;

    try {
      await this.emailQueue.add('otp', { type: 'otp', to, code, otpRedisKey }, opts);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes('already exists')) {
        throw err;
      }
      this.logger.warn(`OTP job ${jobId} already exists — removing and re-adding`);
      await this.removeOtpJob(jobId);
      await this.emailQueue.add('otp', { type: 'otp', to, code, otpRedisKey }, opts);
    }
  }

  /** Stable id per Redis OTP key (no colons — avoids BullMQ job id issues). */
  private otpJobId(otpRedisKey: string): string {
    const digest = createHash('sha256').update(otpRedisKey).digest('hex').slice(0, 24);
    return `otp-${digest}`;
  }

  private async removeOtpJob(jobId: string): Promise<void> {
    try {
      await this.emailQueue.remove(jobId);
    } catch {
      // Job may not exist in any list.
    }
    const existing = await this.emailQueue.getJob(jobId);
    if (existing) {
      try {
        await existing.remove();
      } catch (err) {
        this.logger.warn(
          `Could not remove OTP job ${jobId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
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
