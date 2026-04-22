# --- build ---
FROM node:20-bookworm-slim AS builder
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

# --- run (t3.small: slim image + explicit prisma for migrate) ---
FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma/

# production deps + prisma CLI (migrate deploy) + pm2
RUN npm ci --omit=dev && npm install prisma@5.22.0 pm2 --no-save
RUN npx prisma generate

COPY --from=builder /app/dist ./dist
COPY ecosystem.config.js ./

COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

RUN groupadd --gid 1001 nodejs && useradd --uid 1001 --gid nodejs --shell /bin/bash --create-home nestjs
RUN chown -R nestjs:nodejs /app
USER nestjs

EXPOSE 3000
ENTRYPOINT ["/entrypoint.sh"]
