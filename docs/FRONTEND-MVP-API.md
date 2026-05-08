# DOJEON 학습자 앱 MVP — API 연동 범위

프론트엔드(학습자 웹/앱)가 **MVP에서 다루면 되는 REST API**만 정리한 문서입니다.  
상세 스키마·요청/응답 본문은 이 저장소의 OpenAPI 파일을 기준으로 합니다.

## 이 문서에서 제외하는 것

| 제외 대상 | 사유 |
|-----------|------|
| **관리자 (Admin)** 태그 전부 | 서버·별도 관리자 웹에서 사용. 학습자 앱과 분리. |
| **NLP** 태그 전부 | 서버·워커 내부 처리 위주로 두고, 학습자 클라이언트는 직접 호출하지 않음. |

## 공통 사항 (전체 API와 동일)

- **성공 응답 래퍼**: `{ isSuccess, code, message, data, timestamp }`
- **실패 응답**: `{ isSuccess, code, message, data, errorCode?, timestamp }` 등 (스펙 참고)
- **인증**: 보호된 엔드포인트는 `Authorization: Bearer <accessToken>`  
  - 액세스 만료 시 `POST /auth/reissue` (리프레시 토큰) 사용
- **머신 리더블 전체 명세**: `dojeon-back/openapi/openapi.json`  
  - 갱신: 이 디렉터리에서 `npm run openapi:export`  
  - 프론트 레포에서는 이 파일을 복사한 뒤 Orval 등으로 `codegen`하면 됨.

---

## MVP API 목록 (총 34작업)

`path`의 `{변수}`는 경로 파라미터입니다.

### 인증 (Auth)

| 메서드 | 경로 | 요약 |
|--------|------|------|
| GET | `/auth/check-nickname` | 닉네임 중복 확인 |
| POST | `/auth/email/send` | 이메일 인증 코드 발송 |
| POST | `/auth/email/verify` | 이메일 인증 코드 확인 |
| POST | `/auth/google` | 구글 소셜 로그인 |
| POST | `/auth/login` | 이메일 로그인 |
| POST | `/auth/logout` | 로그아웃 |
| POST | `/auth/password/reset-confirm` | 비밀번호 재설정 확정 |
| POST | `/auth/password/reset-request` | 비밀번호 재설정 요청 |
| POST | `/auth/reissue` | 액세스 토큰 재발급 |
| POST | `/auth/signup` | 회원가입 |

### 사용자 (User)

| 메서드 | 경로 | 요약 |
|--------|------|------|
| DELETE | `/user/me` | 회원 탈퇴 |
| GET | `/user/me` | 내 정보 조회 |
| PATCH | `/user/me` | 내 정보 수정 / 온보딩 정보 저장 |
| GET | `/user/me/achievement` | 업적(뱃지) 목록 조회 |
| PATCH | `/user/me/password` | 비밀번호 변경 (로그인 상태) |
| POST | `/user/me/profileImage/presignedUrl` | 프로필 이미지 업로드 URL 발급 |

### 홈 (Home)

| 메서드 | 경로 | 요약 |
|--------|------|------|
| GET | `/home/resume` | 홈 화면 정보 조회 |

### 학습 (Learning)

| 메서드 | 경로 | 요약 |
|--------|------|------|
| GET | `/courses/dashboard` | 코스 대시보드 조회 |
| GET | `/lessons/{lessonId}/sections` | 레슨 섹션 목록 조회 |

### 섹션 (Section)

| 메서드 | 경로 | 요약 |
|--------|------|------|
| GET | `/section/{sectionId}/card` | 섹션 단어 카드 목록 |
| GET | `/section/{sectionId}/material` | 섹션 학습 자료 목록 |
| GET | `/section/{sectionId}/progress` | 섹션 학습 진행 조회 |
| POST | `/section/{sectionId}/progress` | 섹션 학습 진행 저장 |
| GET | `/section/{sectionId}/question` | 섹션 문제 목록 |
| POST | `/section/{sectionId}/questions/check` | 섹션 문제 채점 |

### 스크랩 (Scrap)

| 메서드 | 경로 | 요약 |
|--------|------|------|
| GET | `/scrap` | 스크랩 목록 조회 |
| POST | `/scrap` | 스크랩 추가 |
| DELETE | `/scrap/{scrapId}` | 스크랩 삭제 |
| GET | `/scrap/dashboard` | 스크랩 대시보드 |

### 연습 (Practice)

| 메서드 | 경로 | 요약 |
|--------|------|------|
| GET | `/practice/topic` | 연습 토픽 목록 |
| GET | `/practice/topic/{topicId}/question` | 토픽 문제 목록 |
| POST | `/practice/topic/{topicId}/questions/check` | 연습 문제 채점 |

### 구독 (Subscription)

| 메서드 | 경로 | 요약 |
|--------|------|------|
| GET | `/subscription/plan` | 구독 플랜 목록 |

### Health

| 메서드 | 경로 | 요약 |
|--------|------|------|
| GET | `/health` | 헬스 체크 (인증 불필요) |

---

## 버전 정보

- 문서 기준 OpenAPI: `openapi/openapi.json` (`npm run openapi:export`로 갱신)
- 백엔드 전체(관리자·NLP 포함)는 동일 파일에 있으므로, **구현·목킹 시 위 표만 필터**해 사용하면 됩니다.
