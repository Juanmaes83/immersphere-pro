-- CaptureJob Fase 2: operational visual jobs.
-- Safe scope: no workers, no OCR, no GPU, no automatic processing.

CREATE TABLE "CaptureJob" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "leadId" TEXT,
  "propertyId" TEXT,
  "title" TEXT NOT NULL,
  "clientName" TEXT NOT NULL,
  "projectType" TEXT NOT NULL DEFAULT 'property',
  "vertical" TEXT NOT NULL DEFAULT 'real_estate',
  "status" TEXT NOT NULL DEFAULT 'draft',
  "priority" TEXT NOT NULL DEFAULT 'medium',
  "source" TEXT NOT NULL DEFAULT 'manual',
  "assignedTo" TEXT NOT NULL DEFAULT '',
  "dueDate" TIMESTAMP(3),
  "estimatedCost" INTEGER,
  "estimatedHours" INTEGER,
  "commercialValue" INTEGER,
  "riskLevel" TEXT NOT NULL DEFAULT 'low',
  "nextAction" TEXT NOT NULL DEFAULT '',
  "notes" TEXT NOT NULL DEFAULT '',
  "publicUrl" TEXT NOT NULL DEFAULT '',
  "qrUrl" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CaptureJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CaptureInputAsset" (
  "id" TEXT NOT NULL,
  "captureJobId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "filename" TEXT NOT NULL DEFAULT '',
  "url" TEXT NOT NULL,
  "publicId" TEXT NOT NULL DEFAULT '',
  "source" TEXT NOT NULL DEFAULT 'manual',
  "format" TEXT NOT NULL DEFAULT '',
  "size" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'received',
  "rightsStatus" TEXT NOT NULL DEFAULT 'unknown',
  "qualityScore" INTEGER,
  "notes" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CaptureInputAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CaptureOutputAsset" (
  "id" TEXT NOT NULL,
  "captureJobId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "format" TEXT NOT NULL DEFAULT '',
  "url" TEXT NOT NULL,
  "publicId" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'planned',
  "viewerReady" BOOLEAN NOT NULL DEFAULT false,
  "mobileReady" BOOLEAN NOT NULL DEFAULT false,
  "publishedUrl" TEXT NOT NULL DEFAULT '',
  "qrUrl" TEXT NOT NULL DEFAULT '',
  "analyticsEnabled" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CaptureOutputAsset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CaptureJob_tenantId_idx" ON "CaptureJob"("tenantId");
CREATE INDEX "CaptureJob_userId_idx" ON "CaptureJob"("userId");
CREATE INDEX "CaptureJob_leadId_idx" ON "CaptureJob"("leadId");
CREATE INDEX "CaptureJob_propertyId_idx" ON "CaptureJob"("propertyId");
CREATE INDEX "CaptureJob_status_idx" ON "CaptureJob"("status");
CREATE INDEX "CaptureJob_priority_idx" ON "CaptureJob"("priority");
CREATE INDEX "CaptureJob_riskLevel_idx" ON "CaptureJob"("riskLevel");
CREATE INDEX "CaptureJob_dueDate_idx" ON "CaptureJob"("dueDate");
CREATE INDEX "CaptureInputAsset_captureJobId_idx" ON "CaptureInputAsset"("captureJobId");
CREATE INDEX "CaptureInputAsset_type_idx" ON "CaptureInputAsset"("type");
CREATE INDEX "CaptureInputAsset_status_idx" ON "CaptureInputAsset"("status");
CREATE INDEX "CaptureOutputAsset_captureJobId_idx" ON "CaptureOutputAsset"("captureJobId");
CREATE INDEX "CaptureOutputAsset_type_idx" ON "CaptureOutputAsset"("type");
CREATE INDEX "CaptureOutputAsset_status_idx" ON "CaptureOutputAsset"("status");

ALTER TABLE "CaptureJob" ADD CONSTRAINT "CaptureJob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CaptureJob" ADD CONSTRAINT "CaptureJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CaptureJob" ADD CONSTRAINT "CaptureJob_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CaptureJob" ADD CONSTRAINT "CaptureJob_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CaptureInputAsset" ADD CONSTRAINT "CaptureInputAsset_captureJobId_fkey" FOREIGN KEY ("captureJobId") REFERENCES "CaptureJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CaptureOutputAsset" ADD CONSTRAINT "CaptureOutputAsset_captureJobId_fkey" FOREIGN KEY ("captureJobId") REFERENCES "CaptureJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
