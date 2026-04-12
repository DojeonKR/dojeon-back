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

  /** INCR 후 첫 호출이면 TTL 설정 (실패 횟수 카운터 등) */
  async incrWithTtlOnFirst(key: string, ttlSeconds: number): Promise<number> {
    const n = await this.client.incr(key);
    if (n === 1) {
      await this.client.expire(key, ttlSeconds);
    }
    return n;
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
