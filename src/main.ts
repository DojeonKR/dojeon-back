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

  const swaggerEnabled = configService.get<boolean>('swaggerEnabled') === true;
  if (!isProd || swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('DOJEON API')
      .setDescription('외국인 대상 한국어 학습 플랫폼 API\n\n모든 성공 응답은 `{ isSuccess, code, message, data, timestamp }` 형태로 래핑됩니다.\n인증이 필요한 엔드포인트는 우측 **Authorize** 버튼에 `Bearer <accessToken>`을 입력하세요.')
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  } else {
    logger.log('Swagger: production에서 비활성 (SWAGGER_ENABLED=true 로 활성화)');
  }

  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? '0.0.0.0';
  await app.listen(port, host);
  console.log(`Application is running on: http://${host}:${port}`);
  if (!isProd || swaggerEnabled) {
    console.log(`Swagger UI: http://localhost:${port}/docs`);
  }
}
bootstrap();
