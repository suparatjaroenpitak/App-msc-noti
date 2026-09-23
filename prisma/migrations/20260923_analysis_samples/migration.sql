-- CreateTable
CREATE TABLE "AnalysisSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "suggestOnCreate" BOOLEAN NOT NULL DEFAULT true,
    "analyzeOnTrigger" BOOLEAN NOT NULL DEFAULT false,
    "lookbackMinutes" INTEGER NOT NULL DEFAULT 240,
    "minSamples" INTEGER NOT NULL DEFAULT 12,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "AnalysisSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceSample" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "price" DECIMAL(12,4) NOT NULL,
    "volume" INTEGER,
    "sampledAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PriceSample_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisSettings_userId_key" ON "AnalysisSettings"("userId");
CREATE UNIQUE INDEX "PriceSample_assetId_sampledAt_key" ON "PriceSample"("assetId", "sampledAt");
CREATE INDEX "PriceSample_assetId_sampledAt_idx" ON "PriceSample"("assetId", "sampledAt");
CREATE INDEX "PriceSample_sampledAt_idx" ON "PriceSample"("sampledAt");

-- AddForeignKey
ALTER TABLE "AnalysisSettings" ADD CONSTRAINT "AnalysisSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PriceSample" ADD CONSTRAINT "PriceSample_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
