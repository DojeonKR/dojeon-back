import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { SqsService } from '../../infra/sqs/sqs.service';
import { AppException } from '../../common/exceptions/app.exception';

@Injectable()
export class NlpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sqs: SqsService,
    private readonly configService: ConfigService,
  ) {}

  async analyze(userId: bigint, text: string): Promise<{ jobId: string }> {
    const queueUrl = (this.configService.get<string>('nlpQueueUrl') ?? '').trim();
    if (!queueUrl) {
      throw new AppException(
        'NLP_QUEUE_NOT_CONFIGURED',
        'NLP 큐가 설정되지 않았습니다.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const job = await this.prisma.nlpJob.create({
      data: {
        userId,
        inputText: text,
        status: 'pending',
      },
    });

    const payload = JSON.stringify({ jobId: job.id, inputText: text });
    try {
      await this.sqs.sendMessage(payload, queueUrl);
    } catch (err) {
      // SQS 전송 실패 시 생성한 레코드를 즉시 삭제해 orphan pending 레코드 방지.
      // 클라이언트는 재시도 가능한 503을 받아 동일 텍스트로 재요청할 수 있다.
      await this.prisma.nlpJob.delete({ where: { id: job.id } }).catch(() => undefined);
      throw new AppException(
        'NLP_QUEUE_ERROR',
        'NLP 분석 요청에 실패했습니다. 잠시 후 다시 시도해주세요.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return { jobId: job.id };
  }

  async getJob(userId: bigint, jobId: string): Promise<{ jobId: string; status: string; result: unknown }> {
    const job = await this.prisma.nlpJob.findFirst({
      where: { id: jobId, userId },
    });
    if (!job) {
      throw new AppException('NLP_JOB_NOT_FOUND', '작업을 찾을 수 없습니다.', HttpStatus.NOT_FOUND);
    }
    return {
      jobId: job.id,
      status: job.status,
      result: job.result ?? null,
    };
  }
}
