import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EmailService } from './email.service';

export const EMAIL_QUEUE = 'email';

export interface OtpEmailJob {
  type: 'otp';
  to: string;
  code: string;
}

export interface TempPasswordEmailJob {
  type: 'temp-password';
  to: string;
  tempPassword: string;
}

export type EmailJobData = OtpEmailJob | TempPasswordEmailJob;

@Processor(EMAIL_QUEUE)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly emailService: EmailService) {
    super();
  }

  async process(job: Job<EmailJobData>): Promise<boolean> {
    const { data } = job;
    try {
      if (data.type === 'otp') {
        return await this.emailService.sendOtpEmail(data.to, data.code);
      }
      if (data.type === 'temp-password') {
        return await this.emailService.sendTempPasswordEmail(data.to, data.tempPassword);
      }
      this.logger.warn(`Unknown email job type: ${(data as { type: string }).type}`);
      return false;
    } catch (err) {
      this.logger.error(
        `Email job ${job.id} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
  }
}
