# DOJEON NLP Lambda Worker

SQS 메시지(`{ jobId, inputText }`)를 받아 `NlpJob` 상태를 갱신하고, 바른 AI(Bareun) API(또는 스텁) 결과를 DB·Redis에 기록합니다.

## 준비

1. 루트(`dojeon-back`)에서 Prisma 클라이언트 생성 (워커가 상위 스키마를 참조):

   ```bash
   cd lambda/nlp-worker
   npm install
   npm run prisma:generate
   ```

2. 환경 변수 (Lambda 콘솔 또는 SAM/Serverless 템플릿):

   | 변수 | 설명 |
   |------|------|
   | `DATABASE_URL` | PostgreSQL 연결 문자열 |
   | `REDIS_URL` | (선택) 결과 캐시용 Redis |
   | `BAREUN_API_URL` | Bareun REST 베이스 URL |
   | `BAREUN_API_KEY` | API 키 (미설정 시 스텁 응답으로 `done` 처리) |

## 빌드

```bash
npm run build
```

`dist/`에 컴파일 결과가 생성됩니다. Lambda에는 `dist/**/*.js`, `node_modules`, 생성된 `@prisma/client`가 포함되어야 합니다.

## 배포 메모

- 트리거: SQS 큐 (API의 `NLP_QUEUE_URL`과 동일 큐).
- Partial batch failure: 실패한 메시지의 `messageId`만 `batchItemFailures`에 넣어 재시도되게 합니다.
- VPC 내부 DB 사용 시 Lambda를 DB와 동일 VPC/서브넷에 두고 보안 그룹을 허용하세요.
