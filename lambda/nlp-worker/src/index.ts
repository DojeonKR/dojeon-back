import type { SQSBatchResponse, SQSHandler, SQSRecord } from 'aws-lambda';
import { getPrisma } from './db';
import { analyzeWithBareun } from './bareun';
import { getRedis, nlpResultCacheKey } from './redis';

interface NlpMessageBody {
  jobId: string;
  inputText: string;
}

async function processRecord(record: SQSRecord): Promise<void> {
  let body: NlpMessageBody;
  try {
    body = JSON.parse(record.body) as NlpMessageBody;
  } catch {
    // 파싱 불가 메시지는 재시도해도 동일하므로 itemFailures에 넣지 않음 (DLQ로 즉시 이동)
    console.error(`[nlp-worker] Invalid SQS body (messageId=${record.messageId}): ${record.body?.slice(0, 200)}`);
    return;
  }

  const { jobId, inputText } = body;
  if (!jobId || !inputText) {
    console.error(`[nlp-worker] Missing jobId or inputText (messageId=${record.messageId})`);
    return;
  }

  const prisma = getPrisma();

  /**
   * 상태 가드: pending 또는 (재시도 시) processing 상태인 경우만 처리.
   * - SQS 가시성 만료 후 재출현한 메시지가 이미 done/failed인 경우 건너뜀.
   * - updateMany count === 0 이면 이미 완료된 작업 → 멱등 처리.
   */
  const guard = await prisma.nlpJob.updateMany({
    where: { id: jobId, status: { in: ['pending', 'processing'] } },
    data: { status: 'processing' },
  });

  if (guard.count === 0) {
    console.log(`[nlp-worker] Job ${jobId} already completed or not found — skipping.`);
    return;
  }

  try {
    const analysis = await analyzeWithBareun(inputText);
    const resultPayload = analysis as unknown as Record<string, unknown>;

    await prisma.nlpJob.update({
      where: { id: jobId },
      data: {
        status: 'done',
        result: resultPayload as object,
      },
    });

    const r = getRedis();
    if (r) {
      await r.setex(nlpResultCacheKey(jobId), 3600, JSON.stringify(resultPayload));
    }
  } catch (err) {
    await prisma.nlpJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        result: { error: err instanceof Error ? err.message : String(err) } as object,
      },
    });
    // 재던짐 → batchItemFailures에 추가 → SQS 재시도
    throw err;
  }
}

export const handler: SQSHandler = async (event): Promise<SQSBatchResponse> => {
  const failures: { itemIdentifier: string }[] = [];

  for (const record of event.Records) {
    try {
      await processRecord(record);
    } catch {
      failures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures: failures };
};
