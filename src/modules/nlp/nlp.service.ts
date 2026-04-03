import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { NlpJobStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../infra/redis/redis.service';
import { SqsService } from '../../infra/sqs/sqs.service';
import { AppException } from '../../common/exceptions/app.exception';
import { HttpStatus } from '@nestjs/common';
import { NlpAnalyzeDto } from './dto/nlp-analyze.dto';

const CACHE_TTL = parseInt(process.env.NLP_REDIS_CACHE_TTL ?? '86400', 10);

@Injectable()
export class NlpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly sqs: SqsService,
  ) {}

  async analyze(userId: bigint, dto: NlpAnalyzeDto) {
    const text = dto.text;
    const hash = createHash('sha256').update(text).digest('hex');
    const cacheKey = `nlp:${hash}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      const result = JSON.parse(cached) as unknown;
      return {
        __envelope: { code: '200', message: '캐시에서 즉시 반환' },
        status: 'DONE' as const,
        result,
      };
    }

    const job = await this.prisma.nlpJob.create({
      data: {
        userId,
        targetText: text,
        status: NlpJobStatus.PENDING,
        cacheKey,
      },
    });

    await this.sqs.sendNlpJobMessage({
      jobId: job.id,
      cacheKey,
      targetText: text,
    });

    return {
      __envelope: { code: '202', message: '분석 요청이 접수되었습니다.' },
      jobId: job.id,
    };
  }

  async getJob(userId: bigint, jobId: string) {
    const job = await this.prisma.nlpJob.findUnique({ where: { id: jobId } });
    if (!job) {
      throw new AppException('NLP_JOB_NOT_FOUND', '작업을 찾을 수 없습니다.', HttpStatus.NOT_FOUND);
    }
    if (job.userId !== userId) {
      throw new AppException('NLP_JOB_FORBIDDEN', '다른 사용자의 작업입니다.', HttpStatus.FORBIDDEN);
    }
    return {
      jobId: job.id,
      status: job.status,
      result: job.resultData,
    };
  }
}
