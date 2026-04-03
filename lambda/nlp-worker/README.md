# DOJEON NLP Worker Lambda

SQS 트리거로 동작하는 바른 AI 형태소 분석 Lambda 함수.

## 동작 흐름

```
POST /nlp/analyze (NestJS)
  └─ SQS SendMessage { jobId, cacheKey, targetText }
        └─ Lambda (이 함수) 트리거
              ├─ NlpJob.status = PROCESSING
              ├─ 바른 AI API 호출
              ├─ 성공: NlpJob.status = DONE + resultData
              │        Redis SET cacheKey (TTL 24h)
              └─ 실패: NlpJob.status = FAILED → DLQ
```

## 환경 변수

| 이름 | 설명 |
|------|------|
| `DATABASE_URL` | PostgreSQL 연결 문자열 |
| `REDIS_URL` | Redis 연결 문자열 |
| `BAREUNA_AI_API_URL` | `https://api.bai.bareunai.com/bareun/api/v1/analyze` |
| `BAREUNA_AI_API_KEY` | 바른 AI API 키 |
| `NLP_REDIS_CACHE_TTL` | Redis 캐시 만료 초 (기본 86400) |

## 빌드 및 배포

```bash
cd lambda/nlp-worker
npm install
npm run build

# ZIP 패키지 생성
# macOS/Linux
npm run package

# Windows
npm run package:win
```

생성된 `lambda.zip`을 AWS Lambda 콘솔 또는 CLI로 업로드합니다.

```bash
aws lambda update-function-code \
  --function-name dojeon-nlp-worker \
  --zip-file fileb://lambda.zip \
  --region ap-northeast-2
```

## Lambda 설정

| 항목 | 권장값 |
|------|--------|
| Runtime | Node.js 20.x |
| Handler | `index.handler` |
| Memory | 256 MB |
| Timeout | 30s |
| SQS 트리거 | Batch size 1, Partial Batch Response 활성화 |
| DLQ | 별도 SQS 큐 연결 권장 |

## SQS 트리거 설정 (AWS 콘솔/CLI)

```bash
aws lambda create-event-source-mapping \
  --function-name dojeon-nlp-worker \
  --event-source-arn arn:aws:sqs:ap-northeast-2:{ACCOUNT}:{QUEUE_NAME} \
  --batch-size 1 \
  --function-response-types ReportBatchItemFailures
```
