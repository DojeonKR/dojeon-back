import { Logger, OnModuleDestroy } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import type Redis from 'ioredis';

/**
 * Redis 기반 Throttler 저장소 (다중 인스턴스 간 카운터 공유).
 * Lua 스크립트 출처: @nest-lab/throttler-storage-redis / wyattjoh/rate-limit-redis
 */
export class RedisThrottlerStorageService implements ThrottlerStorage, OnModuleDestroy {
  private readonly logger = new Logger(RedisThrottlerStorageService.name);
  private readonly scriptSrc: string;

  constructor(
    private readonly redis: Redis,
    private readonly disconnectOnDestroy: boolean,
  ) {
    this.scriptSrc = this.buildScript();
  }

  private buildScript(): string {
    return `
local hitKey = KEYS[1]
local blockKey = KEYS[2]
local ttl = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local blockDuration = tonumber(ARGV[3])

local totalHits = redis.call('INCR', hitKey)
local timeToExpire = redis.call('PTTL', hitKey)

if timeToExpire <= 0 then
  redis.call('PEXPIRE', hitKey, ttl)
  timeToExpire = ttl
end

local isBlocked = redis.call('GET', blockKey)
local timeToBlockExpire = 0

if isBlocked then
  timeToBlockExpire = redis.call('PTTL', blockKey)
elseif totalHits > limit then
  redis.call('SET', blockKey, 1, 'PX', blockDuration)
  isBlocked = '1'
  timeToBlockExpire = blockDuration
end

if isBlocked and timeToBlockExpire <= 0 then
  redis.call('DEL', blockKey)
  redis.call('SET', hitKey, 1, 'PX', ttl)
  totalHits = 1
  timeToExpire = ttl
  isBlocked = false
end

return { totalHits, timeToExpire, isBlocked and 1 or 0, timeToBlockExpire }
`
      .replace(/^\s+/gm, '')
      .trim();
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const hitKey = `{${key}:${throttlerName}}:hits`;
    const blockKey = `{${key}:${throttlerName}}:blocked`;
    const raw = await this.redis.eval(this.scriptSrc, 2, hitKey, blockKey, ttl, limit, blockDuration);
    if (!Array.isArray(raw) || raw.length !== 4) {
      this.logger.error(`Throttler Redis eval unexpected: ${JSON.stringify(raw)}`);
      throw new Error('Throttler storage Redis eval returned invalid payload');
    }
    const totalHits = Number(raw[0]);
    const timeToExpire = Number(raw[1]);
    const isBlocked = Number(raw[2]);
    const timeToBlockExpire = Number(raw[3]);
    return {
      totalHits,
      timeToExpire: Math.ceil(timeToExpire / 1000),
      isBlocked: isBlocked === 1,
      timeToBlockExpire: Math.max(0, Math.ceil(timeToBlockExpire / 1000)),
    };
  }

  async onModuleDestroy(): Promise<void> {
    if (this.disconnectOnDestroy) {
      await this.redis.quit();
    }
  }
}
