# DOJEON Backend

외국인 대상 한국어 학습 플랫폼 API (NestJS + Prisma + PostgreSQL).

## 요구 사항

- Node.js 20+
- Docker (로컬 PostgreSQL / Redis)

## 빠른 시작

1. 의존성 설치

```bash
npm install
```

2. 환경 변수

`.env.example`을 복사해 `.env`를 만들고 `DATABASE_URL`, `REDIS_URL`, `JWT_*` 등을 설정합니다.

3. 로컬 DB

```bash
docker compose up -d
```

4. 스키마 반영 및 시드

```bash
npx prisma generate
npx prisma migrate dev
npm run prisma:seed
```

(또는 `npm run prisma:push`로 스키마만 동기화)

5. 개발 서버

```bash
npm run start:dev
```

API 베이스 URL: `http://localhost:3000/api/v1`

## 응답 포맷

모든 성공 응답은 Global Interceptor로 아래 형태로 래핑됩니다.

```json
{
  "isSuccess": true,
  "code": "200",
  "message": "요청이 성공했습니다.",
  "data": {},
  "timestamp": "2026-04-03T00:00:00.000Z"
}
```

## 주요 엔드포인트

| 영역 | 메서드 | 경로 |
|------|--------|------|
| Auth | POST/GET | `/auth/email/send`, `/auth/email/verify`, `/auth/signup`, `/auth/login`, `/auth/google`, `/auth/reissue`, `/auth/logout`, `/auth/password/reset-request`, `/auth/check-nickname` |
| User | GET/PATCH | `/user/me?year=&month=`, `/user/me/achievement`, `/user/me/profileImage/presignedUrl` |
| Home | GET | `/home/resume` |
| Learning | GET | `/courses/dashboard`, `/lessons/:id/sections` |
| Section | GET/POST | `/section/:id/material`, `/section/:id/card`, `/section/:id/question`, `/section/:id/progress` (Idempotency-Key) |
| Scrap | GET/POST/DELETE | `/scrap/dashboard`, `/scrap?type=VOCAB` 또는 `GRAMMAR` + `sort=recent`, `/scrap`, `/scrap/:scrapId` |
| Practice | GET | `/practice/topic`, `/practice/topic/:topicId/question` |
| Subscription | GET | `/subscription/plan` |
| NLP | POST/GET | `/nlp/analyze`, `/nlp/job/:jobId` |

## 프로덕션 빌드

```bash
npm run build
npm run start:prod
```

## Docker 이미지

```bash
docker build -t dojeon-back .
```

ECS 배포 시 `DATABASE_URL`, `REDIS_URL`, `JWT_*`, `AWS_*` 등을 태스크 정의에서 주입합니다.
