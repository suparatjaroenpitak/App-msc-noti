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
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
# NEXT_PUBLIC_* vars are inlined into the client bundle at BUILD time.
# On Render, set this env var (it flows into the build as a build arg below).
ARG NEXT_PUBLIC_APP_URL
RUN npx prisma generate && npm run build

# ---------- runner ----------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
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
# safe-migrate: รัน `prisma migrate deploy` และถ้าเจอ P3009 (failed migration ค้าง)
# จะแนะนำวิธีแก้ หรือ auto-repair (ล้าง schema + apply ใหม่) เมื่อ DB_AUTO_RECOVER=true
# FRESH_DB_SEED=true จะ seed ข้อมูลเริ่มต้น (demo user + assets) — ปิดหลังใช้งานจริง
CMD ["sh", "-c", "node scripts/safe-migrate.mjs && node scripts/seed-if-fresh.mjs && npm run start"]
