import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

@Injectable()
export class SqsService {
  private readonly logger = new Logger(SqsService.name);
  private readonly client: SQSClient;
  private readonly queueUrl: string;

  constructor(private readonly configService: ConfigService) {
    const region = this.configService.get<string>('aws.region');
    this.queueUrl = this.configService.get<string>('aws.sqsNlpQueueUrl') ?? '';
    this.client = new SQSClient({
      region,
      credentials:
        this.configService.get('aws.accessKeyId') && this.configService.get('aws.secretAccessKey')
          ? {
              accessKeyId: this.configService.get('aws.accessKeyId')!,
              secretAccessKey: this.configService.get('aws.secretAccessKey')!,
            }
          : undefined,
    });
  }

  async sendNlpJobMessage(payload: Record<string, unknown>): Promise<void> {
    if (!this.queueUrl) {
      this.logger.warn('AWS_SQS_NLP_QUEUE_URL not set; skipping SQS publish (dev mode)');
      return;
    }
    await this.client.send(
      new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(payload),
      }),
    );
  }
}
