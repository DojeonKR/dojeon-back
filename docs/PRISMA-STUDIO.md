# Prisma Studio로 DB 보기

브라우저에서 테이블·행을 클릭해서 볼 수 있습니다. (기본 주소: http://localhost:5555)

## 로컬 Docker DB (개발 PC)

```bash
docker compose up -d          # postgres + redis
npm run studio:local          # .env 의 DATABASE_URL (localhost:5432)
```

## EC2 배포 DB (SSH 터널)

EC2 Postgres는 인터넷에 직접 열지 않고, **SSH 터널**로만 접속합니다.

### 1) 설정 파일 만들기

```bash
# macOS / Linux / EC2
cp .env.studio.example .env.studio
```

```powershell
# Windows (PowerShell, dojeon-back 폴더)
copy .env.studio.example .env.studio
```

`.env.studio` 에서 `POSTGRES_PASSWORD_HERE` 를 EC2 `~/dojeon-back/.env` 의 `POSTGRES_PASSWORD` 와 **동일하게** 바꿉니다.

### 2) SSH 터널 켜기 (이 창은 닫지 말 것)

```bash
ssh -i "경로/키.pem" -L 5433:127.0.0.1:5432 ubuntu@3.36.201.255
```

- 로컬 `5433` → EC2의 Postgres `5432` 로 연결됩니다.
- Elastic IP가 바뀌면 `3.36.201.255` 를 실제 IP로 바꿉니다.

### 3) Prisma Studio 실행

```bash
npm run studio:remote
```

브라우저에서 http://localhost:5555 를 엽니다.

- API 호출 후 데이터가 바뀌었으면 Studio에서 **새로고침** (F5).
- Studio를 끄려면 터미널에서 `Ctrl+C`.

### 자주 하는 실수

| 증상 | 원인 |
|------|------|
| `Can't reach database` | SSH 터널이 안 켜짐, 또는 비밀번호 불일치 |
| `connection refused :5433` | 터널 명령을 안 했거나, 로컬 5433 포트 충돌 |
| 빈 DB처럼 보임 | `DATABASE_URL` 이 로컬 docker 를 가리킴 → `.env.studio` 확인 |

## npm 스크립트 요약

| 명령 | 연결 대상 |
|------|-----------|
| `npm run studio:local` | `.env` → 보통 로컬 Docker `localhost:5432` |
| `npm run studio:remote` | `.env.studio` → 터널 `127.0.0.1:5433` (EC2) |

`.env.studio` 는 Git에 올라가지 않습니다 (비밀번호 포함).
