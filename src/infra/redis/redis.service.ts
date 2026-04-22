import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>('redisUrl') ?? 'redis://localhost:6379';
    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 200, 5000),
      enableReadyCheck: true,
    });
    this.client.on('error', (err) => this.logger.error(`Redis error: ${err.message}`));
    this.client.on('reconnecting', () => this.logger.warn('Redis reconnecting...'));
  }

  getClient(): Redis {
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  /**
   * INCR + TTL 설정을 단일 Lua 스크립트로 원자 실행.
   * INCR과 EXPIRE 사이 크래시로 TTL 없는 키가 잔존하는 레이스 컨디션 방지.
   */
  async incrWithTtlOnFirst(key: string, ttlSeconds: number): Promise<number> {
    const script = `
local n = redis.call('INCR', KEYS[1])
if n == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return n
`;
    const result = await this.client.eval(script, 1, key, ttlSeconds);
    return Number(result);
  }

  /**
   * SET NX + TTL (원자적). 키가 없을 때만 설정하고 성공 여부 반환.
   * 분산 락·Idempotency 잠금 등에 사용.
   */
  async setNx(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.client.set(key, value, 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  /**
   * Lua 스크립트로 GET + DEL을 원자 실행. 리프레시 토큰 로테이션에 사용.
   * 키가 없으면 null 반환, 있으면 값을 반환하고 즉시 삭제.
   */
  async getAndDel(key: string): Promise<string | null> {
    const script = `
local val = redis.call('GET', KEYS[1])
if val then
  redis.call('DEL', KEYS[1])
end
return val
`;
    const result = await this.client.eval(script, 1, key);
    return typeof result === 'string' ? result : null;
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
