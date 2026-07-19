#!/bin/sh
set -e

echo "[entrypoint] prisma migrate deploy..."
npx prisma migrate deploy

echo "[entrypoint] Seeding achievements and subscription plans..."
node prisma/seed-app-data.js

echo "[entrypoint] Seeding missing course content..."
node prisma/seed-courses.js --missing-only

echo "[entrypoint] Starting NestJS (PM2 cluster)..."
exec npx pm2-runtime ecosystem.config.js
