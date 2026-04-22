import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ConflictException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Observable, from, lastValueFrom } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { RedisService } from '../../infra/redis/redis.service';
import { Request, Response } from 'express';
import { createHash } from 'crypto';

const TTL_SECONDS = 86400;
/** 동일 키 동시 요청이 처리 완료되길 기다리는 최대 시간 (ms) */
const LOCK_TTL_SECONDS = 30;
const LOCK_POLL_INTERVAL_MS = 100;
const LOCK_MAX_WAIT_MS = 10_000;

/**
 * Idempotency-Key가 있으면 성공 응답 본문 전체를 Redis에 보관(24h)하고 재요청 시 그대로 반환한다.
 *
 * 동시 요청 보호:
 *  - 첫 번째 요청이 "처리 중" 잠금(SET NX)을 획득하고 핸들러를 실행한다.
 *  - 동일 키로 동시에 온 요청은 잠금 해제(결과 캐시 등록) 될 때까지 폴링 후 캐시를 반환한다.
 *  - LOCK_MAX_WAIT_MS 이내에 결과가 없으면 503 반환.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly redis: RedisService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const key = req.headers['idempotency-key'] as string | undefined;
    if (!key) {
      return next.handle();
    }

    const userId = (req as Request & { user?: { userId: bigint } }).user?.userId?.toString() ?? 'anon';
    const bodyHash = createHash('sha256')
      .update(JSON.stringify(req.body ?? {}))
      .digest('hex');
    const redisKey = `idempotency:${req.method}:${req.path}:${userId}:${key}`;
    const lockKey = `idempotency:lock:${req.method}:${req.path}:${userId}:${key}`;

    return from(this.processIdempotent(redisKey, lockKey, bodyHash, res, next)).pipe(
      switchMap((result) => {
        return new Observable((subscriber) => {
          subscriber.next(result);
          subscriber.complete();
        });
      }),
    );
  }

  private async processIdempotent(
    redisKey: string,
    lockKey: string,
    bodyHash: string,
    res: Response,
    next: CallHandler,
  ): Promise<unknown> {
    // 1. 이미 완료된 결과가 있으면 즉시 반환
    const cached = await this.redis.get(redisKey);
    if (cached) {
      const parsed = JSON.parse(cached) as { bodyHash: string; response: unknown };
      if (parsed.bodyHash !== bodyHash) {
        throw new ConflictException('Idempotency-Key가 동일하지만 요청 본문이 다릅니다.');
      }
      res.status(200);
      return parsed.response;
    }

    // 2. 처리 중 잠금 획득 시도 (SET NX)
    const acquired = await this.redis.setNx(lockKey, '1', LOCK_TTL_SECONDS);

    if (!acquired) {
      // 3. 잠금 획득 실패 → 다른 요청이 처리 중 → 결과 완료까지 폴링
      return this.pollForResult(redisKey, bodyHash, res);
    }

    // 4. 잠금 획득 성공 → 핸들러 실행
    try {
      const data = await lastValueFrom(next.handle());
      await this.redis.set(
        redisKey,
        JSON.stringify({ bodyHash, response: data }),
        TTL_SECONDS,
      );
      return data;
    } finally {
      // 잠금 해제 (실패해도 TTL로 자동 만료)
      await this.redis.del(lockKey).catch(() => undefined);
    }
  }

  private async pollForResult(
    redisKey: string,
    bodyHash: string,
    res: Response,
  ): Promise<unknown> {
    const deadline = Date.now() + LOCK_MAX_WAIT_MS;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, LOCK_POLL_INTERVAL_MS));
      const cached = await this.redis.get(redisKey);
      if (cached) {
        const parsed = JSON.parse(cached) as { bodyHash: string; response: unknown };
        if (parsed.bodyHash !== bodyHash) {
          throw new ConflictException('Idempotency-Key가 동일하지만 요청 본문이 다릅니다.');
        }
        res.status(200);
        return parsed.response;
      }
    }
    throw new HttpException(
      '동일한 요청이 처리 중입니다. 잠시 후 다시 시도해주세요.',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
