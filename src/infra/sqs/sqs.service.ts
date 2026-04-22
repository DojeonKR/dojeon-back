import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

@Injectable()
export class SqsService {
  private readonly logger = new Logger(SqsService.name);
  private readonly client: SQSClient;
  private readonly defaultQueueUrl: string;

  constructor(private readonly configService: ConfigService) {
    const region = this.configService.get<string>('aws.region') ?? 'ap-northeast-2';
    const accessKeyId = this.configService.get<string>('aws.accessKeyId');
    const secretAccessKey = this.configService.get<string>('aws.secretAccessKey');
    this.defaultQueueUrl = (this.configService.get<string>('nlpQueueUrl') ?? '').trim();
    this.client = new SQSClient({
      region,
      credentials:
        accessKeyId && secretAccessKey
          ? { accessKeyId, secretAccessKey: secretAccessKey }
          : undefined,
    });
  }

  async sendMessage(body: string, queueUrl?: string): Promise<void> {
    const url = (queueUrl ?? this.defaultQueueUrl).trim();
    if (!url) {
      this.logger.warn('NLP_QUEUE_URL is empty — SQS message not sent');
      throw new Error('NLP_QUEUE_URL is not configured');
    }
    await this.client.send(
      new SendMessageCommand({
        QueueUrl: url,
        MessageBody: body,
      }),
    );
  }
}
