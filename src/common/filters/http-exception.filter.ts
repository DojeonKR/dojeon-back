import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { AppException } from '../exceptions/app.exception';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '서버 오류가 발생했습니다.';
    let errorCode = 'INTERNAL_ERROR';

    if (exception instanceof AppException) {
      status = exception.getStatus();
      const res = exception.getResponse() as { message?: string; errorCode?: string };
      message = typeof res.message === 'string' ? res.message : message;
      errorCode = exception.errorCode;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null && 'message' in res) {
        const m = (res as { message: string | string[] }).message;
        message = Array.isArray(m) ? m.join(', ') : m;
      }
      errorCode = String(status);
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        message = '이미 존재하는 데이터입니다.';
        errorCode = 'DUPLICATE_ENTRY';
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        message = '데이터를 찾을 수 없습니다.';
        errorCode = 'NOT_FOUND';
      } else {
        this.logger.error(exception.message, exception.stack);
      }
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
      message = process.env.NODE_ENV === 'development' ? exception.message : message;
    }

    response.status(status).json({
      isSuccess: false,
      code: String(status),
      message,
      data: null,
      errorCode,
      timestamp: new Date().toISOString(),
    });
  }
}
