#!/usr/bin/env sh
# EC2 Postgres SSH 터널 (Prisma Studio용)
# 사용: ./scripts/studio-tunnel.sh ~/path/to/key.pem [EC2_HOST]
KEY="${1:?Usage: $0 <key.pem> [host]}"
HOST="${2:-3.36.201.255}"
LOCAL_PORT="${LOCAL_PORT:-5433}"

echo "터널: 127.0.0.1:${LOCAL_PORT} -> ${HOST}:5432"
echo "이 창을 연 채로: npm run studio:remote"
exec ssh -i "$KEY" -L "${LOCAL_PORT}:127.0.0.1:5432" "ubuntu@${HOST}"
