# DOJEON 백엔드 진행 현황

> 최종 업데이트: 2026-04-03

---

## 1. 완료된 작업

### 1-1. Prisma 스키마 전면 개정 (`prisma/schema.prisma`)

| 변경 구분 | 항목 |
|-----------|------|
| 신규 테이블 | `section_cards`, `section_materials`, `section_questions` |
| 신규 테이블 | `practice_topics`, `practice_questions` |
| 신규 테이블 | `subscription_plans` |
| 변경 | `sections` — `content Json` 컬럼 제거, 카드·머티리얼·문항 relation 추가 |
| 변경 | `scraps` — `word`/`meaning` 컬럼 제거 → `card_id` FK, `material_id` FK |
| 변경 | `user_section_logs` — `difficulty` 컬럼 추가 |
| 변경 | `nlp_jobs` — `job_id`를 UUID PK로 유지, `cache_key` 컬럼 추가, `section_id` 제거 |
| 변경 | Enum `NlpJobStatus` — `COMPLETED` → `DONE` 으로 변경 |

마이그레이션 SQL: `prisma/migrations/20260403120000_full_plan/migration.sql`  
(실제 DB 적용은 `DATABASE_URL` 설정 후 `npx prisma migrate dev` 또는 `deploy`)

---

### 1-2. 시드 (`prisma/seed.ts`)

- 배지 3종 (첫 발걸음, 7일 연속, 30일 연속)
- 구독 플랜 4종 (free / basic / pro / annual) + upsert
- 샘플 코스·레슨·섹션 + `SectionCard` 3장 + `SectionMaterial` 1개
- 샘플 `PracticeTopic` + `PracticeQuestion` 1개

---

### 1-3. AUTH (`src/modules/auth/`)

| 항목 | 상세 |
|------|------|
| 엔드포인트 리네임 | `email/send-code` → `email/send`, `email/verify-code` → `email/verify`, `refresh` → `reissue` |
| 신규 엔드포인트 | `POST /auth/logout`, `POST /auth/password/reset-request`, `GET /auth/check-nickname` |
| nickname 검증 | `verify` 단계에서 분리 → `signup` 시점 또는 `check-nickname` 활용 |
| username 자동생성 | `generateUniqueUsername(email)` — `이메일로컬_랜덤5자리hex` |
| signup DTO | `username` 필드 제거, 온보딩 필드 추가 (`motherLanguage`, `proficiencyLevel`, `ageGroup`, `dailyGoalMin`) |
| 응답 보강 | 모든 토큰 응답에 `userId` 추가, google 응답에 `isNewUser` |

---

### 1-4. COURSE/LESSON (`src/modules/learning/`)

| 항목 | 상세 |
|------|------|
| `getCoursesDashboard` | `resumeBanner` 신규 (진행 중 섹션 기준), `overallProgressPercent`, 비활성 코스 포함 (`lessons: []`) |
| `getLessonSections` | `lesson.isCompleted`, `overallProgressPercent` (레슨 내 완료 섹션 비율) |
| `getLastLessonResume` | HOME·USER 공통 메서드 — 최근 로그 기준 `lastLesson` 조립 + `grammarPreview` (없으면 `null`) |
| Export | `LearningModule`에서 `LearningService` export → Home·User 모듈에서 재사용 |

`getSectionMaterials` (기존 단일 섹션 조회)는 `/section` 컨트롤러로 이전됨.

---

### 1-5. HOME (신규, `src/modules/home/`)

| 엔드포인트 | 응답 필드 |
|-----------|-----------|
| `GET /home/resume` | `userFirstName`, `dailyStreak`, `todayGoal { targetMin, studiedMin }`, `lastLesson` (null 가능) |

`grammarPreview`: `SectionMaterial.type === 'GRAMMAR_TABLE'`에서 옵셔널 체이닝, 없으면 `null`.

---

### 1-6. SECTION (`src/modules/log/sections.controller.ts` 개편)

| 항목 | 상세 |
|------|------|
| 라우트 prefix | `sections` → **`section`** |
| 신규 | `GET /section/:id/material`, `GET /section/:id/card`, `GET /section/:id/question` |
| progress DTO 변경 | `maxPageReached` → `currentPage`, `deltaStaySeconds` → `stayTimeSeconds`, `difficulty` 추가 |
| progress 응답 변경 | `resume` → `nextSection { courseId, lessonId, sectionId, type, title }` |

---

### 1-7. SCRAP (`src/modules/log/scraps.controller.ts` 전면 수정)

| 항목 | 상세 |
|------|------|
| 라우트 prefix | `scraps` → **`scrap`** |
| 엔드포인트 통합 | `GET /scrap?type=VOCAB\|GRAMMAR&sort=recent` (단일 경로, 충돌 방지) |
| 대시보드 | `GET /scrap/dashboard` — `userName`, `vocabularyPreview { groups }`, `grammarPreview[]` |
| 생성 DTO | `@ValidateIf` 조건부: VOCAB → `cardId` 필수, GRAMMAR → `materialId` 필수 |
| 정규화 | Scrap 생성 시 텍스트 저장 없음, 조회 시 카드·머티리얼 JOIN |
| 응답 | `type` → `targetType`, VOCAB content에 `front`/`back`/`audioUrl` (card JOIN), GRAMMAR에 `grammarPoint` |

---

### 1-8. USER (`src/modules/user/`)

| 항목 | 상세 |
|------|------|
| 라우트 prefix | `users` → **`user`** |
| `GET /user/me` | `?year=&month=` 쿼리 추가 (미지정 시 현재 연월) |
| 응답 보강 | `attendance.activeDays: number[]` (일자 숫자 배열), `stats.bestStreak` (DB `maxStreak` 매핑), `recentCourse` |
| `GET /user/me/achievement` | `earned[]`/`notEarned[]` → 단일 `badges[] + isEarned + earnedAt`, `totalEarned` |
| presigned URL | 경로 → `POST /user/me/profileImage/presignedUrl`, 응답에 `fileUrl` 추가 |

---

### 1-9. PRACTICE (신규, `src/modules/practice/`)

| 엔드포인트 | 설명 |
|-----------|------|
| `GET /practice/topic` | 활성 토픽 목록 |
| `GET /practice/topic/:topicId/question` | 해당 토픽의 문제 목록 |

---

### 1-10. SUBSCRIPTION (신규, `src/modules/subscription/`)

| 엔드포인트 | 설명 |
|-----------|------|
| `GET /subscription/plan` | DB에서 플랜 조회 + 코드 레벨 `benefits[]` 조합 |

---

### 1-11. NLP (`src/modules/nlp/`)

| 항목 | 상세 |
|------|------|
| `POST /nlp/analyze` | Request body: `text` (최대 1000자), SHA256 → Redis 캐시 확인 후 히트 시 즉시 반환 (`code: "200"`), 미스 시 SQS 발행 + jobId 반환 (`code: "202"`) |
| `GET /nlp/job/:jobId` | 2초 폴링용, 본인 job 검증 (403/404), `status`·`result` 반환 |
| `NlpJobStatus` | PENDING → PROCESSING → DONE / FAILED |

---

### 1-12. 공통 인프라 변경

| 항목 | 상세 |
|------|------|
| `ResponseInterceptor` | `__envelope { code, message }` 패턴으로 응답 코드·메시지 오버라이드 가능 (NLP 202 용) |
| `app.module.ts` | `HomeModule`, `PracticeModule`, `SubscriptionModule` 등록 |
| `README.md` | 엔드포인트·마이그레이트 안내 갱신 |

---

## 2. 완료된 추가 작업 (2026-04-03 2차 구현)

| 항목 | 결과 |
|------|------|
| `.env.example` 바른 AI 항목 추가 | `BAREUNA_AI_API_URL`, `BAREUNA_AI_API_KEY`, `NLP_REDIS_CACHE_TTL` |
| `recalculateStreak` 최적화 | 400회 DB 루프 → `findMany` 단일 쿼리 + JS 순회 |
| AWS SES 이메일 발송 | `src/infra/email/email.service.ts`, `EmailModule` (Global) — dev는 로그, prod는 SES |
| Auth 이메일 연동 | `sendEmailCode`, `passwordResetRequest` 에서 `EmailService` 호출 |
| NLP Lambda 워커 | `lambda/nlp-worker/` — SQS 컨슈머, 바른 AI 호출, DB·Redis 업데이트, Partial Batch Response |
| Scrap Pagination | `GET /scrap?type=&cursor=&limit=` 커서 기반 (기본 20, 최대 100) |

---

## 3. 앞으로 해야 할 작업

### 3-1. 데이터베이스 (필수 선행)

```bash
# 로컬 DB가 없는 경우 도커 실행
docker compose up -d

# 환경변수 설정 (.env에 DATABASE_URL 입력)
DATABASE_URL="postgresql://USER:PASS@localhost:5432/dojeon"

# 마이그레이션 적용
npx prisma migrate dev

# 시드 실행
npm run prisma:seed
```

> **주의**: 이미 옛 스키마(content Json, word/meaning 등)가 적용된 DB가 있다면,  
> 컬럼 제거·이름 변경이 있으므로 **데이터 보존용 ALTER 마이그레이션**을 따로 작성해야 합니다.

---

### 3-2. NLP Lambda 배포 (코드 완성 ✅ — AWS 설정 필요)

```bash
cd lambda/nlp-worker
npm install
npm run build
npm run package:win    # Windows: lambda.zip 생성

aws lambda update-function-code \
  --function-name dojeon-nlp-worker \
  --zip-file fileb://lambda.zip
```

Lambda 환경변수: `DATABASE_URL`, `REDIS_URL`, `BAREUNA_AI_API_URL`, `BAREUNA_AI_API_KEY`

---

### 3-3. 콘텐츠 관리 (관리자/마이그레이션)

현재 Section 콘텐츠(단어카드·문법 머티리얼·퀴즈)가 새 테이블로 분리됐지만, **데이터 입력 수단이 없음**.

- [ ] 관리자 API 또는 Prisma Studio로 콘텐츠 입력
- [ ] 기존 `Section.content Json` 데이터를 `SectionCard`/`SectionMaterial`/`SectionQuestion`으로 마이그레이션하는 스크립트

---

### 3-4. AWS SES 검증 (코드 완성 ✅ — AWS 콘솔 설정 필요)

`EmailService`는 구현 완료. prod에서 실제 발송을 위해:

- [ ] AWS SES에서 `EMAIL_FROM` 발신 주소 도메인 인증
- [ ] SES Sandbox → Production 전환 (고객 요청)

---

### 3-5. 테스트

현재 테스트 코드 없음.

- [ ] `AuthService` — signup / login / generateUniqueUsername
- [ ] `LogService` — saveSectionProgress (streak·badge 연동)
- [ ] `NlpService` — Redis 캐시 히트·미스 분기

---

### 3-6. Docker / 배포

- [ ] AWS ECS / ECR 배포 파이프라인 (GitHub Actions 등)

---

### 3-7. 기타 보완 항목

| 항목 | 상태 | 내용 |
|------|------|------|
| 스트릭 최적화 | ✅ 완료 | 단일 `findMany` + JS 순회로 교체 |
| Scrap Pagination | ✅ 완료 | `cursor` / `limit` 쿼리 지원 |
| 이메일 발송 | ✅ 완료 | SES, dev는 로그 출력 |
| 출석 로직 | ⚠️ 보완 권장 | `updatedAt` 기준 당일 학습시간 — 자정 넘어 공부 시 이전 날 로그가 오늘로 집계될 수 있음 |
| Idempotency | 검토 필요 | `POST /scrap`·`POST /nlp/analyze`에도 적용 검토 |

---

## 3. 전체 엔드포인트 현황

| 도메인 | 엔드포인트 | 구현 |
|--------|-----------|------|
| Auth | `POST /auth/email/send` | ✅ |
| Auth | `POST /auth/email/verify` | ✅ |
| Auth | `POST /auth/signup` | ✅ |
| Auth | `POST /auth/login` | ✅ |
| Auth | `POST /auth/google` | ✅ |
| Auth | `POST /auth/reissue` | ✅ |
| Auth | `POST /auth/logout` | ✅ |
| Auth | `POST /auth/password/reset-request` | ✅ (SES 연동 ✅, AWS 도메인 인증 필요) |
| Auth | `GET /auth/check-nickname` | ✅ |
| User | `GET /user/me?year=&month=` | ✅ |
| User | `PATCH /user/me` | ✅ |
| User | `GET /user/me/achievement` | ✅ |
| User | `POST /user/me/profileImage/presignedUrl` | ✅ |
| Home | `GET /home/resume` | ✅ |
| Course | `GET /courses/dashboard` | ✅ |
| Lesson | `GET /lessons/:lessonId/sections` | ✅ |
| Section | `GET /section/:sectionId/material` | ✅ |
| Section | `GET /section/:sectionId/card` | ✅ |
| Section | `GET /section/:sectionId/question` | ✅ |
| Section | `POST /section/:sectionId/progress` | ✅ |
| Scrap | `GET /scrap/dashboard` | ✅ |
| Scrap | `GET /scrap?type=VOCAB\|GRAMMAR&sort=recent` | ✅ |
| Scrap | `POST /scrap` | ✅ |
| Scrap | `DELETE /scrap/:scrapId` | ✅ |
| Practice | `GET /practice/topic` | ✅ |
| Practice | `GET /practice/topic/:topicId/question` | ✅ |
| Subscription | `GET /subscription/plan` | ✅ |
| NLP | `POST /nlp/analyze` | ✅ (Lambda 워커 구현 완료 ✅, AWS 배포 필요) |
| NLP | `GET /nlp/job/:jobId` | ✅ |

---

## 4. 파일 구조 (관련 모듈만)

```
dojeon-back/
├── prisma/
│   ├── schema.prisma           ← 스키마 확정 (SectionCard/Material/Question, PracticeTopic, SubscriptionPlan, NlpJob)
│   ├── seed.ts                 ← 시드 (플랜·뱃지·샘플 콘텐츠)
│   └── migrations/
│       └── 20260403120000_full_plan/migration.sql
├── lambda/
│   └── nlp-worker/             ← SQS Lambda 워커 (완성)
│       ├── src/
│       │   ├── index.ts        ← 핸들러, Partial Batch Response
│       │   ├── bareun.ts       ← 바른 AI API 호출
│       │   ├── db.ts           ← Prisma 싱글톤
│       │   └── redis.ts        ← ioredis 싱글톤
│       └── README.md           ← 빌드·배포 가이드
├── src/
│   ├── app.module.ts           ← Home/Practice/Subscription/Email 모듈 등록
│   ├── common/interceptors/response.interceptor.ts  ← __envelope 202 지원
│   ├── infra/
│   │   ├── email/              ← EmailModule (Global, AWS SES, dev=로그)
│   │   ├── redis/              ← RedisModule
│   │   └── sqs/                ← SqsModule
│   └── modules/
│       ├── auth/               ← 리네임, logout, reset-request, check-nickname, SES 연동
│       ├── learning/           ← resumeBanner, overallProgressPercent, getLastLessonResume
│       ├── home/               ← 신규 (GET /home/resume)
│       ├── practice/           ← 신규 (GET /practice/topic, /question)
│       ├── subscription/       ← 신규 (GET /subscription/plan + benefits)
│       ├── log/
│       │   ├── scraps.controller.ts   ← /scrap, cursor pagination
│       │   ├── sections.controller.ts ← /section, material/card/question
│       │   ├── log.service.ts         ← 스트릭 최적화, Pagination, JOIN 조회
│       │   └── dto/
│       │       ├── create-scrap.dto.ts      ← @ValidateIf 조건부
│       │       └── section-progress.dto.ts  ← currentPage, stayTimeSeconds, difficulty
│       ├── user/               ← /user, bestStreak, activeDays?year=&month=, recentCourse
│       └── nlp/                ← text, __envelope 202, job/:jobId
└── PROGRESS.md                 ← 이 파일
```
