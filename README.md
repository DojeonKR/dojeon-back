# DOJEON Backend

DDD(Domain-Driven Design) 설계 패턴을 적용한 Spring Boot 백엔드 프로젝트입니다.

## 🏗️ 프로젝트 구조

```
src/main/java/kr/dojeon/
├── domain/              # 도메인 레이어 (비즈니스 로직)
│   └── user/           # 사용자 도메인 (예시)
│       ├── controller/ # REST API 엔드포인트
│       ├── service/    # 비즈니스 로직
│       ├── repository/ # 데이터 접근 계층
│       ├── entity/     # JPA 엔티티
│       └── dto/        # 데이터 전송 객체
├── global/             # 전역 설정 및 공통 기능
│   ├── config/         # 설정 클래스 (Security, JPA 등)
│   ├── exception/      # 전역 예외 처리
│   ├── common/         # 공통 응답 객체
│   └── util/           # 유틸리티 클래스
└── infra/              # 외부 인프라 연동
    ├── aws/            # AWS 서비스 연동
    └── redis/          # Redis 연동
```

## 🚀 시작하기

### 필수 요구사항

- Java 17 이상
- Gradle 7.x 이상

### 실행 방법

1. 의존성 설치
```bash
./gradlew clean build
```

2. 애플리케이션 실행
```bash
./gradlew bootRun
```

3. H2 콘솔 접속
- URL: http://localhost:8080/api/h2-console
- JDBC URL: jdbc:h2:mem:testdb
- Username: sa
- Password: (비워두기)

## 📝 API 엔드포인트 (예시)

### User API

- `POST /api/users` - 사용자 생성
- `GET /api/users/{id}` - 사용자 조회
- `GET /api/users` - 전체 사용자 조회
- `PUT /api/users/{id}` - 사용자 수정
- `DELETE /api/users/{id}` - 사용자 삭제

## 🔧 기술 스택

- **Framework**: Spring Boot 3.2.1
- **Language**: Java 17
- **Build Tool**: Gradle
- **Database**: H2 (개발), MySQL/PostgreSQL (운영 가능)
- **ORM**: Spring Data JPA
- **Security**: Spring Security
- **Utilities**: Lombok

## 📚 설계 원칙

### DDD (Domain-Driven Design)
- 도메인별로 패키지를 분리하여 응집도 높은 설계
- 각 도메인은 독립적으로 Controller-Service-Repository 계층 구조 유지

### 계층형 아키텍처
- **Controller**: HTTP 요청/응답 처리
- **Service**: 비즈니스 로직 처리
- **Repository**: 데이터 접근 로직
- **Entity**: 도메인 객체
- **DTO**: 계층 간 데이터 전송

### 전역 레이어
- 여러 도메인에서 공통으로 사용하는 설정, 예외 처리, 유틸리티 모음

### 인프라 레이어
- 외부 시스템 연동을 위한 별도 레이어
- AWS, Redis 등 외부 서비스와의 통신 담당

## 📖 개발 가이드

### 새로운 도메인 추가하기

1. `domain` 패키지 하위에 새로운 도메인 패키지 생성
2. 다음 하위 패키지 생성:
   - `controller` - REST API 엔드포인트
   - `service` - 비즈니스 로직
   - `repository` - JPA Repository
   - `entity` - JPA Entity
   - `dto` - Request/Response DTO

### 예외 처리
- 비즈니스 예외는 `BusinessException` 사용
- `ErrorCode` enum에 새로운 에러 코드 추가
- `GlobalExceptionHandler`가 자동으로 처리

### API 응답 형식
모든 API는 `ApiResponse<T>` 래퍼 클래스를 사용하여 일관된 응답 형식 유지:
```json
{
  "success": true,
  "data": {...},
  "message": null,
  "errorCode": null
}
```

## 🔐 보안

- Spring Security 기본 설정 적용
- TODO: JWT 토큰 기반 인증 구현 필요
- TODO: 비밀번호 암호화 로직 추가 필요

## 📌 TODO

- [ ] JWT 인증/인가 구현
- [ ] 실제 운영 데이터베이스 설정 (MySQL/PostgreSQL)
- [ ] 로깅 설정 (Logback)
- [ ] API 문서화 (Swagger/SpringDoc)
- [ ] 테스트 코드 작성
- [ ] Docker 설정
- [ ] CI/CD 파이프라인 구성
