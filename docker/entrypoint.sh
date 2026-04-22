#!/bin/sh
set -e

echo "[entrypoint] prisma migrate deploy..."
npx prisma migrate deploy

echo "[entrypoint] Starting NestJS (PM2 cluster)..."
exec npx pm2-runtime ecosystem.config.js
