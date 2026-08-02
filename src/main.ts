import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule } from '@nestjs/swagger';
import { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { createOpenApiDocument } from './swagger/create-openapi-document';

// JSON 직렬화 시 BigInt 지원
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

/** Origin 헤더는 스킴+호스트(+포트)만 보내고 경로/트레일링 슬래시가 없으므로, 설정값을 동일 형태로 정규화한다. */
function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function buildCorsOptions(configService: ConfigService) {
  const raw = configService.get<string>('corsOrigin')?.trim() ?? '';
  if (!raw) {
    return { origin: true };
  }
  const origins = raw.split(',').map(normalizeOrigin).filter(Boolean);
  if (origins.length === 0) {
    return { origin: true };
  }
  // '*' 가 포함되면 요청 Origin을 그대로 반영(allow-all). credentials와 함께 쓸 수 있도록 origin:true 사용.
  if (origins.includes('*')) {
    return { origin: true, credentials: true };
  }
  return {
    origin: origins,
    credentials: true,
  };
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const expressApp = app.getHttpAdapter().getInstance();
  // There is exactly one trusted reverse-proxy hop (nginx -> API container).
  expressApp.set('trust proxy', 1);
  expressApp.disable('x-powered-by');
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    next();
  });
  app.enableShutdownHooks();
  const configService = app.get(ConfigService);
  const nodeEnv = configService.get<string>('nodeEnv') ?? 'development';
  const isProd = nodeEnv === 'production';
  const corsRaw = configService.get<string>('corsOrigin')?.trim() ?? '';
  const accessSecret = configService.get<string>('jwt.accessSecret') ?? '';
  const refreshSecret = configService.get<string>('jwt.refreshSecret') ?? '';
  const unsafeSecret = (value: string) => value.length < 32 || value.startsWith('dev-');
  if (isProd && (!corsRaw || corsRaw.split(',').map(normalizeOrigin).includes('*'))) {
    logger.error(
      'production에서는 CORS_ORIGIN을 반드시 설정하세요. (비어 있으면 기동하지 않습니다)',
    );
    process.exit(1);
  }
  if (isProd && (unsafeSecret(accessSecret) || unsafeSecret(refreshSecret))) {
    logger.error('Production JWT secrets must be non-default values of at least 32 characters.');
    process.exit(1);
  }
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  const corsOpts = buildCorsOptions(configService);
  app.enableCors(corsOpts);
  if (corsRaw) {
    logger.log(`CORS 허용 Origin: ${corsRaw}`);
  } else {
    logger.warn('CORS: 모든 Origin 허용 (개발 전용; production에서는 CORS_ORIGIN 필수)');
  }

  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? '0.0.0.0';

  const swaggerEnabled = configService.get<boolean>('swaggerEnabled') === true;
  if (!isProd || swaggerEnabled) {
    const document = createOpenApiDocument(app);
    SwaggerModule.setup('docs', app, document, {
      customSiteTitle: 'DOJEON API',
      jsonDocumentUrl: 'docs-json',
      yamlDocumentUrl: 'docs-yaml',
    });
  } else {
    logger.log('Swagger: production에서 비활성 (SWAGGER_ENABLED=true 로 활성화)');
  }

  await app.listen(port, host);
  const listenUrl = host === '0.0.0.0' ? `http://127.0.0.1:${port}` : `http://${host}:${port}`;
  console.log(`Application is running on: ${listenUrl}`);
  if (!isProd || swaggerEnabled) {
    console.log(`Swagger UI: ${listenUrl}/docs`);
    console.log(`OpenAPI JSON: ${listenUrl}/docs-json`);
    console.log(`OpenAPI YAML: ${listenUrl}/docs-yaml`);
  }
}
bootstrap();
