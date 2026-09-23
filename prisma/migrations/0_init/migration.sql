-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('STOCK', 'ETF');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('ENTRY', 'EXIT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AlertCondition" AS ENUM ('ABOVE_OR_EQUAL', 'BELOW_OR_EQUAL');

-- CreateEnum
CREATE TYPE "AlertEventStatus" AS ENUM ('TRIGGERED', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationLogStatus" AS ENUM ('SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "AiAnalysisKind" AS ENUM ('ON_TRIGGER', 'SUGGEST_PRICE');

-- CreateEnum
CREATE TYPE "AiVerdict" AS ENUM ('BUY', 'WAIT', 'AVOID');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "image" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "usedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "type" "AssetType" NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchlistItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "condition" "AlertCondition" NOT NULL,
    "targetPrice" DECIMAL(12,4) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "oneTime" BOOLEAN NOT NULL DEFAULT false,
    "cooldownMinutes" INTEGER NOT NULL DEFAULT 60,
    "notificationMessage" TEXT,
    "soundId" TEXT,
    "lastTriggeredAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertEvent" (
    "id" TEXT NOT NULL,
    "alertRuleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "currentPrice" DECIMAL(12,4) NOT NULL,
    "targetPrice" DECIMAL(12,4) NOT NULL,
    "triggeredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "AlertEventStatus" NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "AlertEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "deviceName" TEXT,
    "lastUsedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "entryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "exitEnabled" BOOLEAN NOT NULL DEFAULT true,
    "customEnabled" BOOLEAN NOT NULL DEFAULT true,
    "defaultSoundId" TEXT,
    "volume" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationSound" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "duration" DOUBLE PRECISION,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "NotificationSound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "alertEventId" TEXT,
    "pushSubscriptionId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "NotificationLogStatus" NOT NULL,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "analyzeOnTrigger" BOOLEAN NOT NULL DEFAULT false,
    "suggestOnCreate" BOOLEAN NOT NULL DEFAULT true,
    "baseUrl" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'llama3.1:8b',
    "timeoutSeconds" INTEGER NOT NULL DEFAULT 60,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AiSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiAnalysis" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "alertEventId" TEXT,
    "symbol" TEXT NOT NULL,
    "kind" "AiAnalysisKind" NOT NULL,
    "priceAtAnalysis" DECIMAL(12,4) NOT NULL,
    "model" TEXT NOT NULL,
    "verdict" "AiVerdict",
    "suggestedEntryPrice" DECIMAL(12,4),
    "suggestedStopPrice" DECIMAL(12,4),
    "suggestedTargetPrice" DECIMAL(12,4),
    "confidence" DOUBLE PRECISION,
    "horizonDays" INTEGER,
    "rationale" TEXT,
    "rawResponse" TEXT,
    "ok" BOOLEAN NOT NULL,
    "error" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aiSettingsId" TEXT,

    CONSTRAINT "AiAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_symbol_key" ON "Asset"("symbol");

-- CreateIndex
CREATE INDEX "WatchlistItem_userId_sortOrder_idx" ON "WatchlistItem"("userId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "WatchlistItem_userId_assetId_key" ON "WatchlistItem"("userId", "assetId");

-- CreateIndex
CREATE INDEX "AlertRule_userId_enabled_idx" ON "AlertRule"("userId", "enabled");

-- CreateIndex
CREATE INDEX "AlertRule_assetId_enabled_idx" ON "AlertRule"("assetId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "AlertRule_userId_assetId_name_key" ON "AlertRule"("userId", "assetId", "name");

-- CreateIndex
CREATE INDEX "AlertEvent_alertRuleId_idx" ON "AlertEvent"("alertRuleId");

-- CreateIndex
CREATE INDEX "AlertEvent_alertRuleId_triggeredAt_idx" ON "AlertEvent"("alertRuleId", "triggeredAt");

-- CreateIndex
CREATE INDEX "AlertEvent_userId_triggeredAt_idx" ON "AlertEvent"("userId", "triggeredAt");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");

-- CreateIndex
CREATE INDEX "NotificationLog_userId_sentAt_idx" ON "NotificationLog"("userId", "sentAt");

-- CreateIndex
CREATE INDEX "NotificationLog_alertEventId_idx" ON "NotificationLog"("alertEventId");

-- CreateIndex
CREATE UNIQUE INDEX "AiSettings_userId_key" ON "AiSettings"("userId");

-- CreateIndex
CREATE INDEX "AiAnalysis_userId_createdAt_idx" ON "AiAnalysis"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiAnalysis_symbol_createdAt_idx" ON "AiAnalysis"("symbol", "createdAt");

-- CreateIndex
CREATE INDEX "AiAnalysis_alertEventId_idx" ON "AiAnalysis"("alertEventId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_soundId_fkey" FOREIGN KEY ("soundId") REFERENCES "NotificationSound"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_alertRuleId_fkey" FOREIGN KEY ("alertRuleId") REFERENCES "AlertRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_defaultSoundId_fkey" FOREIGN KEY ("defaultSoundId") REFERENCES "NotificationSound"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationSound" ADD CONSTRAINT "NotificationSound_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_alertEventId_fkey" FOREIGN KEY ("alertEventId") REFERENCES "AlertEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_pushSubscriptionId_fkey" FOREIGN KEY ("pushSubscriptionId") REFERENCES "PushSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSettings" ADD CONSTRAINT "AiSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAnalysis" ADD CONSTRAINT "AiAnalysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAnalysis" ADD CONSTRAINT "AiAnalysis_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAnalysis" ADD CONSTRAINT "AiAnalysis_alertEventId_fkey" FOREIGN KEY ("alertEventId") REFERENCES "AlertEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAnalysis" ADD CONSTRAINT "AiAnalysis_aiSettingsId_fkey" FOREIGN KEY ("aiSettingsId") REFERENCES "AiSettings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

