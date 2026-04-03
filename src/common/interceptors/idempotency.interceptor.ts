import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ConflictException,
} from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import { RedisService } from '../../infra/redis/redis.service';
import { Request, Response } from 'express';
import { createHash } from 'crypto';

const TTL_SECONDS = 86400;

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

    return from(this.redis.get(redisKey)).pipe(
      switchMap((cached) => {
        if (cached) {
          const parsed = JSON.parse(cached) as { bodyHash: string; response: unknown };
          if (parsed.bodyHash !== bodyHash) {
            throw new ConflictException('Idempotency-Key가 동일하지만 요청 본문이 다릅니다.');
          }
          res.status(200);
          return new Observable((subscriber) => {
            subscriber.next(parsed.response);
            subscriber.complete();
          });
        }
        return next.handle().pipe(
          tap(async (data) => {
            await this.redis.set(
              redisKey,
              JSON.stringify({ bodyHash, response: data }),
              TTL_SECONDS,
            );
          }),
        );
      }),
    );
  }
}
