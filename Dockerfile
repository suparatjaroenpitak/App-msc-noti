# ---------- deps ----------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ---------- build ----------
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# DATABASE_URL is only needed for `prisma generate`; no DB is contacted at build time.
ENV DATABASE_URL="file:/tmp/build.db"
# NEXT_PUBLIC_* vars are inlined into the client bundle at BUILD time.
# On Render, set this env var (it flows into the build as a build arg below).
ARG NEXT_PUBLIC_APP_URL
RUN npx prisma generate && npm run build

# ---------- runner ----------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# SQLite lives in /app/data — mount a volume here to persist across deploys.
RUN mkdir -p /app/data
VOLUME ["/app/data"]
RUN addgroup -S app && adduser -S app -G app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src ./src
COPY --from=builder /app/worker ./worker
COPY --from=builder /app/tsconfig.json ./tsconfig.json

RUN chown -R app:app /app
USER app

EXPOSE 3000
# start-with-worker: migrate (มี preflight/timeout + auto-repair P3009 เมื่อ DB_AUTO_RECOVER=true)
# → seed (opt-in FRESH_DB_SEED=true) → Next.js + background worker ใน process เดียว
# (SQLite เป็นไฟล์เดียว — รัน worker คนละ container กับ app ไม่ได้)
CMD ["sh", "-c", "node scripts/start-with-worker.mjs"]
