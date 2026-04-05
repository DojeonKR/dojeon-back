# Ubuntu EC2 초기 세팅 & Docker 배포 명령어

SSH 접속 후 **위에서부터 순서대로** 실행합니다.  
`<>` 안은 본인 값으로 바꿉니다.

---

## 0. SSH 접속 (로컬 PC에서)

```powershell
ssh -i "C:\Users\samsung-user\Downloads\dojeon.pem" ubuntu@<탄력적_IP>
```

---

## 1. 패키지 업데이트

```bash
sudo apt update && sudo apt upgrade -y
```

---

## 2. Swap 2GB (t3.small 권장)

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
sudo sysctl vm.swappiness=10
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
free -h
```

---

## 3. Docker Engine + Compose 플러그인 설치

공식 저장소 기준 (Ubuntu):

```bash
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "${VERSION_CODENAME:-$VERSION}") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

`ubuntu` 사용자가 `docker` 명령을 쓰려면:

```bash
sudo usermod -aG docker $USER
```

**한 번 로그아웃 후 다시 SSH 접속**하거나, 같은 세션에서만 임시로:

```bash
newgrp docker
```

확인:

```bash
docker --version
docker compose version
```

---

## 4. 앱 소스 가져오기

GitHub 등에서 클론 (URL은 본인 레포로 변경):

```bash
cd ~
git clone <https://github.com/본인/dojeon-back.git>
cd dojeon-back
```

(또는 `scp` / `rsync`로 로컬에서 업로드)

---

## 5. 환경 변수 파일

```bash
cp .env.example .env
nano .env
```

최소로 맞출 항목:

- `POSTGRES_PASSWORD` — DB 비밀번호 (영숫자 위주 권장)
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — 긴 랜덤 문자열
- `CORS_ORIGIN` — 프론트 URL (쉼표 구분), 예: `https://app.example.com`
- (선택) `GOOGLE_CLIENT_ID`, `AWS_*`, `EMAIL_FROM` 등

Compose가 `DATABASE_URL` / `REDIS_URL`을 API 컨테이너에 넣으므로, **로컬용 `localhost` URL은 EC2에서는 덮어써도 됨** (api 서비스의 `environment` 참고).

---

## 6. 보안 그룹 (AWS 콘솔)

인바운드에 **TCP 3000** (또는 Nginx 사용 시 **80, 443**) 허용. SSH **22**는 본인 IP 권장.

---

## 7. 컨테이너 기동 (PostgreSQL + Redis + API)

프로젝트 루트(`dojeon-back`)에서 **먼저** 아래로 `api` 서비스가 Compose에 잡히는지 확인합니다.

```bash
docker compose --profile api config --services
```

출력에 **`postgres`**, **`redis`**, **`api`** 세 개가 모두 있어야 합니다. **`api`가 없으면** EC2의 `docker-compose.yml`이 오래된 것입니다.

```bash
git pull
grep -n "^  api:" docker-compose.yml
```

`api:` 블록이 없거나 `grep` 결과가 없으면 원격에 푸시한 최신 `docker-compose.yml`이 반영되지 않은 것이므로, **레포를 최신으로 맞춘 뒤** 다시 확인합니다.

기동 (프로파일은 `--profile api` 권장 — 환경변수만으로는 환경에 따라 무시되는 경우가 있음):

```bash
docker compose --profile api up -d --build
```

(`export COMPOSE_PROFILES=api` 후 `docker compose up` 도 동일하게 동작하는 경우가 많습니다.)

로그·상태:

```bash
docker compose --profile api ps
docker compose --profile api logs -f api
```

---

## 8. 동작 확인

서버 안에서:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/docs
```

브라우저(로컬 PC): `http://<탄력적_IP>:3000/docs`

---

## 9. Nginx 리버스 프록시 (외부는 80 → 내부 3000)

보안 그룹에 **3000을 열지 않고**, **80(및 나중에 443)** 만 열어두고 API로 넘기려면 Nginx가 **호스트에서** `127.0.0.1:3000` 으로 프록시합니다.  
(Docker API 컨테이너가 `3000:3000` 으로 떠 있어야 함.)

### 9-1. 사이트 설정 파일 생성

```bash
sudo nano /etc/nginx/sites-available/dojeon-api
```

아래 내용 저장 (`server_name` 은 도메인 있으면 `api.example.com`, 없으면 `_` 유지):

```nginx
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 9-2. 활성화 및 기본 사이트 정리

```bash
sudo ln -sf /etc/nginx/sites-available/dojeon-api /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### 9-3. 확인

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1/docs
```

브라우저: **`http://<탄력적_IP>/docs`** (포트 생략 = 80)

보안 그룹: **22, 80**(필요 시 **443**) 만 열고 **3000 인바운드는 제거**해도 됨.

### 9-4. HTTPS (도메인 있을 때, 선택)

- Route 53 등에서 **도메인 A 레코드** → 탄력적 IP.
- `server_name` 을 실제 도메인으로 바꾼 뒤:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.example.com
```

이후 프론트·Swagger는 `https://api.example.com/docs` 형태로 사용.

---

## 10. (선택) 방화벽 ufw

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

Nginx만 쓸 때는 **3000 포트 규칙은 넣지 않아도** 됨 (내부 localhost만 사용).

---

## 11. 문제 해결 (P1000, `curl` 000, 502)

### `docker compose down -v` 로 DB를 초기화했는데도 P1000 / `curl`이 000인 경우

- **`down -v`가 맞게 끝나면** 새 Postgres 볼륨은 **현재 `.env`의 `POSTGRES_PASSWORD` 한 가지**로만 초기화됩니다. “비밀번호가 자동으로 다른 값으로 재설정된다”기보다, **지금 `.env`에 적어 둔 값이 곧 DB 비밀번호**입니다.
- **`curl` HTTP 코드 `000`** 은 “연결 실패”입니다. **`dojeon-api`가 `Restarting`이거나 3000에서 안 떠 있으면** 항상 000입니다. 원인은 로그에 있습니다.

**여전히 `P1000`(인증 실패)이면 흔한 원인:**

1. **볼륨이 실제로 안 지워짐** — 다른 디렉터리에서 `compose`를 쓰면 **프로젝트 이름이 달라** 예전 볼륨이 남을 수 있음. 항상 **`cd ~/dojeon-back`** 후:
   ```bash
   docker compose --profile api down -v
   docker volume ls | grep dojeon
   ```
   `dojeon-back_*` 볼륨이 없어야 합니다.

2. **`POSTGRES_PASSWORD`에 `@`, `#`, `%`, 공백 등** — `DATABASE_URL` 안에 그대로 들어가 **URL이 깨져** Prisma가 잘못된 비밀번호로 접속합니다. **영문·숫자 위주**(예: 24자 이상 랜덤)로 바꿔 보세요.

3. **`.env` 위치/이름** — `docker-compose.yml`과 **같은 디렉터리**의 `.env`인지 확인 (`~/dojeon-back/.env`).

**502 (Nginx)** — 보통 **3000에 API가 없을 때**입니다. 위를 해결해 `docker compose --profile api ps`에서 `dojeon-api`가 **Up**이고, 서버 안에서 `curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/docs` 가 **200** 근처가 되면 Nginx도 정상으로 이어집니다.

**`curl`이 바로 `000`일 때** — 컨테이너가 막 `Started` 된 직후에는 **아직 `prisma migrate deploy`가 돌아가는 중**일 수 있습니다. 그때는 3000에 아무 것도 안 떠 있어 `000`이 나옵니다. 아래로 로그 끝에 `Application is running` 이 보일 때까지 기다린 뒤 다시 `curl` 하세요.

```bash
docker compose --profile api logs api --tail=30 -f
# (Nest 기동 메시지 확인 후 Ctrl+C)
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/docs
```

### `P3009` / `P3018` — 마이그레이션 실패 (첫 적용에서도 발생 가능)

- **`P3018`** + Postgres `syntax error at or near "\u{feff}"` 등: `migration.sql` 파일 맨 앞에 **UTF-8 BOM**이 들어간 경우입니다. Windows에서 메모장 등으로 저장하면 생길 수 있어, **UTF-8(BOM 없음)**으로 저장하거나 BOM을 제거해야 합니다.
- **`P3009`**: 이전 실행이 실패해 `_prisma_migrations`에 **실패** 기록이 남은 경우입니다. (첫 실행이 **P3018**로 깨지면 곧바로 **P3009**로 반복될 수 있음)

이전에 마이그레이션이 **중간에 실패**하면, Postgres의 `_prisma_migrations` 테이블에 **실패** 상태가 남고, 이후 `prisma migrate deploy`는 **P3009**로 막힙니다. (비밀번호가 맞아도 API는 **기동하지 않음** — 엔트리포인트가 migrate에서 종료)

**개발·스테이징에서 DB 데이터를 지워도 될 때 (가장 단순):** 볼륨까지 지우고 **완전히 새 DB**로 다시 올립니다.

```bash
cd ~/dojeon-back
docker compose --profile api down -v
docker volume ls | grep dojeon   # dojeon-back_dojeon_pg_data 가 없어야 함
docker compose --profile api up -d --build
```

**운영 등 데이터를 유지해야 할 때**는 [Prisma 문서 — migrate resolve](https://www.prisma.io/docs/orm/prisma-migrate/workflows/troubleshooting#failed-migration)를 보고, 실패한 마이그레이션을 **수동으로 스키마·데이터에 맞게 정리한 뒤** `prisma migrate resolve`로 상태를 맞춥니다. (중간까지 적용된 상태일 수 있어 난이도가 높음)

---

## 자주 쓰는 명령

```bash
# 재배포 (코드 갱신 후)
cd ~/dojeon-back
git pull
docker compose --profile api up -d --build

# 중지
docker compose --profile api down

# DB만 띄우고 로컬처럼 개발할 때는 api 프로파일 없이
docker compose up -d
```

자세한 설명은 `DOCKER.md` 참고.
