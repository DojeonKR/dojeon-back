import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiSuccessEnvelope<T> {
  isSuccess: true;
  code: string;
  message: string;
  data: T;
  timestamp: string;
}

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiSuccessEnvelope<unknown>> {
    return next.handle().pipe(
      map((data) => {
        let code = '200';
        let message = '요청이 성공했습니다.';
        let payload: unknown = data;
        if (data && typeof data === 'object' && '__envelope' in data) {
          const d = data as {
            __envelope: { code: string; message?: string };
            [key: string]: unknown;
          };
          code = d.__envelope.code;
          message = d.__envelope.message ?? message;
          const { __envelope, ...rest } = d;
          payload = Object.keys(rest).length ? rest : null;
        }
        return {
          isSuccess: true,
          code,
          message,
          data: payload ?? null,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
