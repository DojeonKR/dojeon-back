import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/** Swagger UI·Orval 등에서 공통으로 쓰는 OpenAPI 문서 생성 */
export function createOpenApiDocument(app: INestApplication) {
  const configService = app.get(ConfigService);
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
        '- OpenAPI JSON: `/docs-json` (Postman·Orval 등)',
        '- OpenAPI YAML: `/docs-yaml`',
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

  return SwaggerModule.createDocument(app, swaggerConfig);
}
