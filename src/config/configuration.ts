export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  /** production에서만 true일 때 Swagger UI 활성 (기본 비활성) */
  swaggerEnabled: process.env.SWAGGER_ENABLED === 'true',
  /**
   * OpenAPI `servers`에 추가할 절대 베이스 URL (예: https://api.example.com, 끝 슬래시 없음).
   * 비우면 상대 서버 `/`만 등록되며, 보낸 OpenAPI 스펙과 Try it out이 문서를 연 호스트를 기준으로 동작합니다.
   */
  swaggerServerUrl: (process.env.SWAGGER_SERVER_URL ?? '').trim(),
  /** 쉼표로 구분된 허용 Origin (비우면 모든 Origin 허용 — 개발 편의). production에서는 필수. */
  corsOrigin: process.env.CORS_ORIGIN ?? '',
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-in-production-min-32',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-in-production-min-32',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '30m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
  },
  aws: {
    region: process.env.AWS_REGION ?? 'ap-northeast-2',
    s3Bucket: process.env.AWS_S3_BUCKET ?? '',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  /** 설정 시 presigned 응답의 fileUrl 등 공개 읽기 URL에 사용 (예: https://d111111abcdef8.cloudfront.net, 끝 슬래시 없음 권장) */
  cloudfrontBaseUrl: process.env.CLOUDFRONT_BASE_URL ?? '',
  emailFrom: process.env.EMAIL_FROM ?? 'noreply@dojeon.local',
  resendApiKey: process.env.RESEND_API_KEY ?? '',
  nlpQueueUrl: process.env.NLP_QUEUE_URL ?? '',
});
