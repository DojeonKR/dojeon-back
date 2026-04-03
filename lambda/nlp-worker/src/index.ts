import type { SQSEvent, SQSRecord } from 'aws-lambda';
import { Prisma } from '@prisma/client';
import { getPrisma } from './db';
import { getRedis } from './redis';
import { analyzeBareun } from './bareun';

const CACHE_TTL = parseInt(process.env.NLP_REDIS_CACHE_TTL ?? '86400', 10);

interface SqsPayload {
  jobId: string;
  cacheKey: string;
  targetText: string;
}

async function processRecord(record: SQSRecord): Promise<void> {
  const prisma = getPrisma();
  const redis = getRedis();

  let payload: SqsPayload;
  try {
    payload = JSON.parse(record.body) as SqsPayload;
  } catch {
    console.error('[nlp-worker] SQS body parse failed:', record.body);
    throw new Error('INVALID_PAYLOAD');
  }

  const { jobId, cacheKey, targetText } = payload;
  console.log(`[nlp-worker] Processing jobId=${jobId}`);

  // 1. PROCESSING 상태로 전환
  await prisma.nlpJob.update({
    where: { id: jobId },
    data: { status: 'PROCESSING' },
  });

  try {
    // 2. 바른 AI 호출
    const result = await analyzeBareun(targetText);

    // 3. DB 업데이트: DONE
    await prisma.nlpJob.update({
      where: { id: jobId },
      data: {
        status: 'DONE',
        resultData: result as unknown as Prisma.InputJsonValue,
      },
    });

    // 4. Redis 캐시 저장
    if (cacheKey) {
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result));
    }

    console.log(`[nlp-worker] Done jobId=${jobId}, morphemes=${result.morphemes.length}`);
  } catch (err) {
    console.error(`[nlp-worker] Failed jobId=${jobId}:`, err);

    await prisma.nlpJob.update({
      where: { id: jobId },
      data: { status: 'FAILED' },
    });

    // SQS DLQ로 이동시키기 위해 에러를 다시 던짐
    throw err;
  }
}

export const handler = async (event: SQSEvent): Promise<{ batchItemFailures: { itemIdentifier: string }[] }> => {
  const failures: { itemIdentifier: string }[] = [];

  await Promise.allSettled(
    event.Records.map(async (record) => {
      try {
        await processRecord(record);
      } catch {
        // Partial Batch Response: 실패한 레코드만 DLQ로 보냄
        failures.push({ itemIdentifier: record.messageId });
      }
    }),
  );

  return { batchItemFailures: failures };
};
