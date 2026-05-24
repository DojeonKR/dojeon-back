# PLAN: 온보딩 상태 추적 & 비밀번호 변경 UX 개선

> 작성일: 2026-05-24  
> 대상 브랜치: 별도 feature 브랜치 후 main 머지  
> 관련 파일: prisma/schema.prisma, user.service.ts, user.controller.ts, change-password.dto.ts, patch-user.dto.ts

---

## 배경

1. 사용자가 온보딩 도중 앱을 이탈하면 다음 로그인 시 처음 온보딩부터 다시 진행해야 한다. 현재 User 모델에 온보딩 완료 여부를 나타내는 필드가 없어 프론트에서 판단할 수 없다.
2. 설정 화면에서 비밀번호를 EDIT 버튼으로 바로 수정할 때 현재 비밀번호 확인 절차가 불필요하다. 또한 소셜 로그인 전용 계정(비밀번호 없음)에 대해 UI를 분기해야 하므로, `GET /user/me`에서 비밀번호 설정 여부를 반환해야 한다.

---

## 작업 1: 온보딩 상태 추적 (`isOnboarded`)

### 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `prisma/schema.prisma` | `User` 모델에 `isOnboarded Boolean @default(false)` 추가 |
| DB 마이그레이션 | `prisma migrate dev --name add_is_onboarded` |
| `src/modules/user/dto/patch-user.dto.ts` | `isOnboarded?: boolean` 필드 추가 |
| `src/modules/user/user.service.ts` | `getDashboard` 반환 `profile`에 `isOnboarded` 포함, `patchMe`에서 업데이트 지원 |
| `src/modules/user/user.controller.ts` | Swagger 예시 업데이트 |

### 사용 흐름

```
로그인 → GET /user/me → profile.isOnboarded 확인
  false → 온보딩 첫 단계 화면으로 이동
  true  → 홈 화면으로 이동

온보딩 마지막 단계 완료 시:
  PATCH /user/me { isOnboarded: true, ...온보딩데이터 }
```

### GET /user/me 응답 변경 (profile 블록)

```json
{
  "profile": {
    "userId": "1",
    "isOnboarded": false,
    ...기존 필드 유지
  }
}
```

---

## 작업 2: 비밀번호 변경 UX 개선

### 화면 설계 방침

Account Info 화면에서 Password 행의 `**********`은 **실제 비밀번호와 무관한 고정 시각 마스킹** (10개 고정)이다.  
EDIT 버튼을 누르면 새 비밀번호 입력 필드만 열리며, 현재 비밀번호 확인은 요구하지 않는다.

소셜 로그인 전용 계정(비밀번호 미설정)은 Password 행 자체를 숨겨야 하므로, `GET /user/me`에서 `hasPassword: boolean`을 반환한다.

```
hasPassword: true  → Password 행 표시 + EDIT 버튼 노출
hasPassword: false → Password 행 전체 숨김 (Google 전용 계정 등)
```

### 변경 내용 요약

| 항목 | 현재 | 변경 후 |
|------|------|---------|
| `PATCH /user/me/password` 요청 바디 | `{ currentPassword, newPassword }` | `{ newPassword }` |
| `GET /user/me` profile 추가 필드 | 없음 | `hasPassword: boolean` |
| 화면의 `**` 개수 | 실제 비밀번호 길이 기반 (의도) | 10개 고정 (시각적 플레이스홀더) |

> **보안 참고**: `currentPassword` 제거 시 accessToken 탈취(유효기간 30분) 상태에서 비밀번호 변경이 가능해진다. 비밀번호 재설정 OTP 흐름(`POST /auth/password/reset-request`)이 별도로 존재하므로, 탈취된 토큰 만료 후 피해를 차단할 수 있다. `passwordLength` 변수는 불필요하며 추가하지 않는다.

### 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/modules/user/dto/change-password.dto.ts` | `currentPassword` 필드 제거 |
| `src/modules/user/user.service.ts` | `changePassword`: bcrypt 비교 로직 제거, newPassword 해싱 후 업데이트만 수행 |
| `src/modules/user/user.service.ts` | `getDashboard`: profile에 `hasPassword: boolean` (`passwordHash !== null`) 추가 |
| `src/modules/user/user.controller.ts` | Swagger 예시 업데이트 (401 응답 제거, hasPassword 예시 추가) |

### GET /user/me 응답 변경 (profile 블록)

```json
{
  "profile": {
    "userId": "1",
    "hasPassword": true,
    ...기존 필드 유지
  }
}
```

---

## 구현 순서

1. `prisma/schema.prisma` 수정 (isOnboarded 추가)
2. `prisma migrate dev` 실행
3. `patch-user.dto.ts` 수정 (isOnboarded 추가)
4. `change-password.dto.ts` 수정 (currentPassword 제거)
5. `user.service.ts` 수정 (getDashboard, patchMe, changePassword)
6. `user.controller.ts` Swagger 예시 업데이트
7. `openapi:export` 재실행 및 프론트 공유
