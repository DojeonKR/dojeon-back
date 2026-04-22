import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

// JSON 직렬화 시 BigInt 지원
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

function buildCorsOptions(configService: ConfigService) {
  const raw = configService.get<string>('corsOrigin')?.trim() ?? '';
  if (!raw) {
    return { origin: true };
  }
  const origins = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (origins.length === 0) {
    return { origin: true };
  }
  return {
    origin: origins,
    credentials: true,
  };
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  const configService = app.get(ConfigService);
  const nodeEnv = configService.get<string>('nodeEnv') ?? 'development';
  const isProd = nodeEnv === 'production';
  const corsRaw = configService.get<string>('corsOrigin')?.trim() ?? '';
  if (isProd && !corsRaw) {
    logger.error('production에서는 CORS_ORIGIN을 반드시 설정하세요. (비어 있으면 기동하지 않습니다)');
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
    const swaggerServerUrl = configService.get<string>('swaggerServerUrl') ?? '';
    const docBuilder = new DocumentBuilder()
      .setTitle('DOJEON API')
      .setDescription(
        [
          '외국인 대상 한국어 학습 플랫폼 API',
          '',
          '**응답 형식**',
          '- 성공: `{ isSuccess, code, message, data, timestamp }`',
          '- 실패: `{ isSuccess, code, message, data, errorCode?, timestamp }`',
          '',
          '**인증**',
          '- 보호된 엔드포인트는 `Authorization: Bearer <accessToken>`',
          '- Swagger에서는 우측 **Authorize**에 토큰만 넣으면 됩니다 (Bearer 접두어 없이).',
          '',
          '**프론트엔드용 스펙 파일**',
          `- OpenAPI JSON: \`/docs-json\` (Postman·OpenAPI Generator 등에서 Import)`,
          `- OpenAPI YAML: \`/docs-yaml\``,
        ].join('\n'),
      )
      .setVersion('1.0')
      .addServer('/', '문서를 연 호스트와 동일 (로컬·배포 공통)');
    if (swaggerServerUrl) {
      docBuilder.addServer(swaggerServerUrl.replace(/\/$/, ''), '고정 베이스 URL (SWAGGER_SERVER_URL)');
    }
    const swaggerConfig = docBuilder
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
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
