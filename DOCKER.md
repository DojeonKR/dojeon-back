# Docker 배포 가이드 (Ubuntu EC2 · t3.small)

PostgreSQL + Redis + Nest API를 **한 호스트**에서 Compose로 올리는 구성입니다.  
DB/Redis는 Docker 네트워크 내부 전용이며, **외부에 노출되는 포트는 API `3000`뿐**입니다.

## 아키텍처 요약

| 서비스 | 역할 | 호스트 바인딩 |
|--------|------|----------------|
| `postgres` | Prisma 마이그레이션 대상 | 없음 (내부만) |
| `redis` | 세션·캐시·idempotency | 없음 (내부만) |
| `api` | NestJS | `0.0.0.0:3000` |

`t3.small`(2GB RAM) 기준으로 **메모리 상한**을 두었습니다. Swap 2GB는 EC2에 별도로 설정하는 것을 권장합니다.

## 로컬 개발 (DB + Redis만)

호스트에서 `npm run start:dev`를 쓸 때:

```bash
cp .env.example .env
# .env에 POSTGRES_PASSWORD 추가 (docker-compose.yml과 동일 값)
docker compose up -d
```

`DATABASE_URL`은 `postgresql://dojeon:<비밀번호>@localhost:5432/dojeon?schema=public` 형태로 맞춥니다.

## EC2 전체 스택 (API 포함)

1. 서버에 레포 클론, `.env` 생성 (`.env.docker.example` 참고).
2. `POSTGRES_PASSWORD`, `JWT_*` 등 필수 값 설정.
3. 아래 중 하나로 **api 프로파일** 활성화:

```bash
# 방법 A
export COMPOSE_PROFILES=api
docker compose up -d --build

# 방법 B
COMPOSE_PROFILES=api docker compose up -d --build
```

4. 확인: `curl -s http://127.0.0.1:3000/docs` (서버 내부) 또는 보안 그룹에서 `3000` 또는 Nginx 뒤 `80/443` 허용 후 접속.

## 운영 시 권장

- **HTTPS**: Nginx/Caddy 리버스 프록시 + Let’s Encrypt, API는 `127.0.0.1:3000`만 리슨하게 두고 프록시만 공개.
- **비밀번호**: `POSTGRES_PASSWORD`에 `@`, `#` 등 URL 예약 문자가 있으면 `DATABASE_URL` 이스케이프 이슈가 생길 수 있으므로 **영숫자 위주** 권장.
- **백업**: `dojeon_pg_data` 볼륨 또는 주기적 `pg_dump`.
- **시드** (선택): `COMPOSE_PROFILES=api docker compose run --rm api npx prisma db seed` (시드 스크립트가 있을 때).

## EC2와 프론트엔드 연결

1. **보안 그룹 인바운드**  
   - API 직접 노출: **TCP 3000** (또는 Nginx 사용 시 **80, 443**만).  
   - SSH 22는 가능하면 본인 IP만.

2. **프론트 환경 변수**  
   - 베이스 URL 예: `http://<탄력적 IP>:3000` 또는 `https://api.도메인`  
   - 요청 경로는 `/auth/login` 등 (글로벌 `/api/v1` prefix 없음).

3. **CORS**  
   - 서버 `.env`에 `CORS_ORIGIN` 설정 (쉼표로 여러 Origin).  
   - 예: `CORS_ORIGIN=https://app.vercel.app,http://localhost:5173`  
   - 비우면 **모든 Origin 허용**(개발 편의). **운영에서는 반드시 프론트 URL로 제한**할 것.

4. **HTTPS / Mixed Content**  
   - 프론트가 `https://`인데 API가 `http://`이면 브라우저가 차단할 수 있음 → API도 HTTPS(Nginx + Let’s Encrypt) 권장.

5. **인증**  
   - JWT는 `Authorization: Bearer <accessToken>`. 쿠키 세션을 쓰면 도메인·SameSite 추가 설정 필요.

6. **확인**  
   - EC2 내부: `curl -s http://127.0.0.1:3000/docs`  
   - 로컬 PC: `curl http://<탄력적 IP>:3000/docs`

## 트러블슈팅

- **migrate 실패**: Postgres 헬스체크 통과 후에도 첫 기동 시 지연되면 `docker compose logs -f api` 확인.
- **메모리 부족**: `docker stats`로 확인 후 인스턴스 업그레이드 또는 RDS/Redis 분리 검토.
- **CORS 에러**: 브라우저 콘솔에 차단 메시지 → `CORS_ORIGIN`에 **프론트 페이지의 정확한 Origin**(스킴+호스트+포트) 추가.
