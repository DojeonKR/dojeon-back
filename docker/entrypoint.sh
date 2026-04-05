#!/bin/sh
set -e

echo "[entrypoint] prisma migrate deploy..."
npx prisma migrate deploy

echo "[entrypoint] Starting NestJS..."
exec node dist/main.js
