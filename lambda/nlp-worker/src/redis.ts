import Redis from 'ioredis';

let redis: Redis | null = null;

export function getRedis(): Redis | null {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;
  if (!redis) {
    redis = new Redis(url, { maxRetriesPerRequest: 2 });
  }
  return redis;
}

export async function disconnectRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}

/** NLP 결과 캐시 (동일 문장 재요청 시 Lambda 외부에서도 활용 가능) */
export function nlpResultCacheKey(jobId: string): string {
  return `nlp:result:${jobId}`;
}
