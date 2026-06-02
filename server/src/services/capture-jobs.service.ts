import QRCode from 'qrcode';
import { prisma } from '../index.js';
import { AppError } from '../middleware/errorHandler.js';

const CAPTURE_JOB_STATUSES = [
  'draft',
  'received',
  'assets_review',
  'needs_more_material',
  'ready_for_processing',
  'processing_manual',
  'processing_lab',
  'qa_review',
  'client_review',
  'approved',
  'published',
  'connected_to_crm',
  'archived',
  'failed',
  'cancelled'
] as const;

const INPUT_ASSET_STATUSES = ['pending', 'received', 'approved', 'rejected', 'needs_review', 'replaced'] as const;
const OUTPUT_ASSET_STATUSES = ['planned', 'in_progress', 'ready', 'in_review', 'approved', 'published', 'archived'] as const;
const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
const RISK_LEVELS = ['low', 'medium', 'high', 'blocked'] as const;
const PREMIUM_3D_OUTPUT_TYPES = [
  'gaussian_splat',
  'splat_viewer',
  'supersplat',
  'spark_viewer',
  'external_3d_viewer'
] as const;
const EMBEDDABLE_3D_HOSTS = [
  'superspl.at',
  'sparkjs.dev',
  'playcanvas.com',
  'luma.ai',
  'lumalabs.ai',
  'immersphere.io',
  'immersphere-pro.vercel.app'
] as const;

type Db = typeof prisma & {
  captureJob: any;
  captureInputAsset: any;
  captureOutputAsset: any;
};

function getDb(): Db {
  return prisma as Db;
}

export interface CaptureJobFilters {
  q?: string;
  status?: string;
  priority?: string;
  riskLevel?: string;
}

export interface CaptureJobInput {
  leadId?: string | null;
  propertyId?: string | null;
  title: string;
  clientName: string;
  projectType?: string;
  vertical?: string;
  status?: string;
  priority?: string;
  source?: string;
  assignedTo?: string;
  dueDate?: string | null;
  estimatedCost?: number | null;
  estimatedHours?: number | null;
  commercialValue?: number | null;
  riskLevel?: string;
  nextAction?: string;
  notes?: string;
  publicUrl?: string;
  qrUrl?: string;
}

export interface CaptureInputAssetInput {
  type: string;
  filename?: string;
  url: string;
  publicId?: string;
  source?: string;
  format?: string;
  size?: number;
  status?: string;
  rightsStatus?: string;
  qualityScore?: number | null;
  notes?: string;
}

export interface CaptureOutputAssetInput {
  type: string;
  format?: string;
  url: string;
  publicId?: string;
  status?: string;
  viewerReady?: boolean;
  mobileReady?: boolean;
  publishedUrl?: string;
  qrUrl?: string;
  analyticsEnabled?: boolean;
  notes?: string;
}

function assertValue(value: string | undefined, allowed: readonly string[], label: string): void {
  if (value !== undefined && !allowed.includes(value)) {
    throw new AppError(400, `${label} invalido: ${value}. Valores permitidos: ${allowed.join(', ')}.`);
  }
}

function cleanString(value: string | undefined | null, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function isPremium3dOutputType(type: string | undefined | null): boolean {
  return PREMIUM_3D_OUTPUT_TYPES.includes(cleanString(type) as (typeof PREMIUM_3D_OUTPUT_TYPES)[number]);
}

function parseExternalViewerUrl(rawUrl: string, label: string): URL {
  const value = cleanString(rawUrl);
  if (!value) throw new AppError(400, `${label} requerido para outputs 3D premium.`);

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new AppError(400, `${label} debe ser una URL valida.`);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new AppError(400, `${label} debe usar http o https.`);
  }

  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.local')
  ) {
    throw new AppError(400, `${label} no puede apuntar a hosts locales o privados.`);
  }

  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [, aRaw, bRaw] = ipv4;
    const a = Number(aRaw);
    const b = Number(bRaw);
    if (
      a === 10 ||
      a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      (a === 100 && b >= 64 && b <= 127)
    ) {
      throw new AppError(400, `${label} no puede apuntar a redes privadas.`);
    }
  }

  return parsed;
}

function canEmbedPremium3dUrl(rawUrl: string): boolean {
  try {
    const parsed = parseExternalViewerUrl(rawUrl, 'url');
    const host = parsed.hostname.toLowerCase();
    return EMBEDDABLE_3D_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}

function validatePremium3dOutputUrl(input: Partial<CaptureOutputAssetInput>): void {
  if (!isPremium3dOutputType(input.type)) return;
  parseExternalViewerUrl(input.publishedUrl || input.url || '', 'url');
  if (input.publishedUrl) parseExternalViewerUrl(input.publishedUrl, 'publishedUrl');
}

function parseDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(400, 'dueDate debe ser una fecha ISO valida o null.');
  }
  return parsed;
}

function buildJobData(input: Partial<CaptureJobInput>, isCreate: boolean): Record<string, unknown> {
  assertValue(input.status, CAPTURE_JOB_STATUSES, 'Estado CaptureJob');
  assertValue(input.priority, PRIORITIES, 'Prioridad');
  assertValue(input.riskLevel, RISK_LEVELS, 'Riesgo');

  const data: Record<string, unknown> = {};
  if (isCreate || input.title !== undefined) data.title = cleanString(input.title) || undefined;
  if (isCreate || input.clientName !== undefined) data.clientName = cleanString(input.clientName) || undefined;
  if (input.projectType !== undefined) data.projectType = cleanString(input.projectType, 'property');
  if (input.vertical !== undefined) data.vertical = cleanString(input.vertical, 'real_estate');
  if (input.status !== undefined) data.status = input.status;
  if (input.priority !== undefined) data.priority = input.priority;
  if (input.source !== undefined) data.source = cleanString(input.source, 'manual');
  if (input.assignedTo !== undefined) data.assignedTo = cleanString(input.assignedTo);
  if ('dueDate' in input) data.dueDate = parseDate(input.dueDate);
  if ('estimatedCost' in input) data.estimatedCost = input.estimatedCost ?? null;
  if ('estimatedHours' in input) data.estimatedHours = input.estimatedHours ?? null;
  if ('commercialValue' in input) data.commercialValue = input.commercialValue ?? null;
  if (input.riskLevel !== undefined) data.riskLevel = input.riskLevel;
  if (input.nextAction !== undefined) data.nextAction = cleanString(input.nextAction);
  if (input.notes !== undefined) data.notes = cleanString(input.notes);
  if (input.publicUrl !== undefined) data.publicUrl = cleanString(input.publicUrl);
  if (input.qrUrl !== undefined) data.qrUrl = cleanString(input.qrUrl);

  if (isCreate && !data.title) throw new AppError(400, 'title requerido.');
  if (isCreate && !data.clientName) throw new AppError(400, 'clientName requerido.');

  return data;
}

async function assertPropertyAccess(propertyId: string | null | undefined, tenantId: string): Promise<void> {
  if (!propertyId) return;
  const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { tenantId: true } });
  if (!property) throw new AppError(404, 'Propiedad no encontrada.');
  if (property.tenantId !== tenantId) throw new AppError(403, 'No tienes acceso a esta propiedad.');
}

async function assertLeadAccess(leadId: string | null | undefined, tenantId: string): Promise<void> {
  if (!leadId) return;
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { property: { select: { tenantId: true } } }
  });
  if (!lead) throw new AppError(404, 'Lead no encontrado.');
  if (lead.property.tenantId !== tenantId) throw new AppError(403, 'No tienes acceso a este lead.');
}

async function getJobForTenant(captureJobId: string, tenantId: string) {
  const job = await getDb().captureJob.findFirst({
    where: { id: captureJobId, tenantId },
    include: {
      property: { select: { id: true, title: true } },
      lead: { select: { id: true, email: true, phone: true, status: true } },
      inputAssets: { orderBy: { createdAt: 'desc' } },
      outputAssets: { orderBy: { createdAt: 'desc' } }
    }
  });
  if (!job) throw new AppError(404, 'CaptureJob no encontrado.');
  return job;
}

export async function listCaptureJobs(tenantId: string, filters: CaptureJobFilters = {}) {
  const where: Record<string, unknown> = { tenantId };
  if (filters.status) where.status = filters.status;
  if (filters.priority) where.priority = filters.priority;
  if (filters.riskLevel) where.riskLevel = filters.riskLevel;
  if (filters.q) {
    where.OR = [
      { title: { contains: filters.q, mode: 'insensitive' } },
      { clientName: { contains: filters.q, mode: 'insensitive' } },
      { nextAction: { contains: filters.q, mode: 'insensitive' } }
    ];
  }

  return getDb().captureJob.findMany({
    where,
    include: {
      property: { select: { id: true, title: true } },
      lead: { select: { id: true, email: true, status: true } },
      _count: { select: { inputAssets: true, outputAssets: true } }
    },
    orderBy: [{ updatedAt: 'desc' }],
    take: 200
  });
}

export async function getCaptureJob(captureJobId: string, tenantId: string) {
  return getJobForTenant(captureJobId, tenantId);
}

export async function createCaptureJob(tenantId: string, userId: string, input: CaptureJobInput) {
  await assertPropertyAccess(input.propertyId, tenantId);
  await assertLeadAccess(input.leadId, tenantId);
  return getDb().captureJob.create({
    data: {
      ...buildJobData(input, true),
      tenantId,
      userId,
      leadId: input.leadId || null,
      propertyId: input.propertyId || null
    },
    include: {
      property: { select: { id: true, title: true } },
      lead: { select: { id: true, email: true, status: true } },
      inputAssets: true,
      outputAssets: true
    }
  });
}

export async function updateCaptureJob(captureJobId: string, tenantId: string, input: Partial<CaptureJobInput>) {
  await getJobForTenant(captureJobId, tenantId);
  if ('propertyId' in input) await assertPropertyAccess(input.propertyId, tenantId);
  if ('leadId' in input) await assertLeadAccess(input.leadId, tenantId);

  return getDb().captureJob.update({
    where: { id: captureJobId },
    data: {
      ...buildJobData(input, false),
      ...(input.leadId !== undefined ? { leadId: input.leadId || null } : {}),
      ...(input.propertyId !== undefined ? { propertyId: input.propertyId || null } : {})
    },
    include: {
      property: { select: { id: true, title: true } },
      lead: { select: { id: true, email: true, status: true } },
      inputAssets: { orderBy: { createdAt: 'desc' } },
      outputAssets: { orderBy: { createdAt: 'desc' } }
    }
  });
}

export async function archiveCaptureJob(captureJobId: string, tenantId: string) {
  await getJobForTenant(captureJobId, tenantId);
  return getDb().captureJob.update({ where: { id: captureJobId }, data: { status: 'archived' } });
}

export async function generateCaptureJobQr(captureJobId: string, tenantId: string) {
  const job = await getJobForTenant(captureJobId, tenantId);
  const target = cleanString(job.publicUrl);
  if (!target) throw new AppError(400, 'Define publicUrl antes de generar QR.');
  const qrUrl = await QRCode.toDataURL(target, { margin: 1, width: 640 });
  return getDb().captureJob.update({ where: { id: captureJobId }, data: { qrUrl } });
}

export async function createCaptureInputAsset(captureJobId: string, tenantId: string, input: CaptureInputAssetInput) {
  await getJobForTenant(captureJobId, tenantId);
  assertValue(input.status, INPUT_ASSET_STATUSES, 'Estado InputAsset');
  if (!cleanString(input.type)) throw new AppError(400, 'type requerido.');
  if (!cleanString(input.url)) throw new AppError(400, 'url requerida.');
  return getDb().captureInputAsset.create({
    data: {
      captureJobId,
      type: cleanString(input.type),
      filename: cleanString(input.filename),
      url: cleanString(input.url),
      publicId: cleanString(input.publicId),
      source: cleanString(input.source, 'manual'),
      format: cleanString(input.format),
      size: input.size ?? 0,
      status: input.status ?? 'received',
      rightsStatus: cleanString(input.rightsStatus, 'unknown'),
      qualityScore: input.qualityScore ?? null,
      notes: cleanString(input.notes)
    }
  });
}

export async function updateCaptureInputAsset(captureJobId: string, assetId: string, tenantId: string, input: Partial<CaptureInputAssetInput>) {
  await getJobForTenant(captureJobId, tenantId);
  assertValue(input.status, INPUT_ASSET_STATUSES, 'Estado InputAsset');
  const existing = await getDb().captureInputAsset.findFirst({ where: { id: assetId, captureJobId } });
  if (!existing) throw new AppError(404, 'Input asset no encontrado.');
  return getDb().captureInputAsset.update({
    where: { id: assetId },
    data: {
      ...(input.type !== undefined ? { type: cleanString(input.type) } : {}),
      ...(input.filename !== undefined ? { filename: cleanString(input.filename) } : {}),
      ...(input.url !== undefined ? { url: cleanString(input.url) } : {}),
      ...(input.publicId !== undefined ? { publicId: cleanString(input.publicId) } : {}),
      ...(input.source !== undefined ? { source: cleanString(input.source, 'manual') } : {}),
      ...(input.format !== undefined ? { format: cleanString(input.format) } : {}),
      ...(input.size !== undefined ? { size: input.size } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.rightsStatus !== undefined ? { rightsStatus: cleanString(input.rightsStatus, 'unknown') } : {}),
      ...(input.qualityScore !== undefined ? { qualityScore: input.qualityScore } : {}),
      ...(input.notes !== undefined ? { notes: cleanString(input.notes) } : {})
    }
  });
}

export async function markCaptureInputAssetReplaced(captureJobId: string, assetId: string, tenantId: string) {
  return updateCaptureInputAsset(captureJobId, assetId, tenantId, { status: 'replaced' });
}

export async function createCaptureOutputAsset(captureJobId: string, tenantId: string, input: CaptureOutputAssetInput) {
  await getJobForTenant(captureJobId, tenantId);
  assertValue(input.status, OUTPUT_ASSET_STATUSES, 'Estado OutputAsset');
  validatePremium3dOutputUrl(input);
  if (!cleanString(input.type)) throw new AppError(400, 'type requerido.');
  if (!cleanString(input.url)) throw new AppError(400, 'url requerida.');
  return getDb().captureOutputAsset.create({
    data: {
      captureJobId,
      type: cleanString(input.type),
      format: cleanString(input.format),
      url: cleanString(input.url),
      publicId: cleanString(input.publicId),
      status: input.status ?? 'planned',
      viewerReady: Boolean(input.viewerReady),
      mobileReady: Boolean(input.mobileReady),
      publishedUrl: cleanString(input.publishedUrl),
      qrUrl: cleanString(input.qrUrl),
      analyticsEnabled: Boolean(input.analyticsEnabled),
      notes: cleanString(input.notes)
    }
  });
}

export async function updateCaptureOutputAsset(captureJobId: string, assetId: string, tenantId: string, input: Partial<CaptureOutputAssetInput>) {
  await getJobForTenant(captureJobId, tenantId);
  assertValue(input.status, OUTPUT_ASSET_STATUSES, 'Estado OutputAsset');
  const existing = await getDb().captureOutputAsset.findFirst({ where: { id: assetId, captureJobId } });
  if (!existing) throw new AppError(404, 'Output asset no encontrado.');
  validatePremium3dOutputUrl({
    type: input.type ?? existing.type,
    url: input.url ?? existing.url,
    publishedUrl: input.publishedUrl ?? existing.publishedUrl
  });
  return getDb().captureOutputAsset.update({
    where: { id: assetId },
    data: {
      ...(input.type !== undefined ? { type: cleanString(input.type) } : {}),
      ...(input.format !== undefined ? { format: cleanString(input.format) } : {}),
      ...(input.url !== undefined ? { url: cleanString(input.url) } : {}),
      ...(input.publicId !== undefined ? { publicId: cleanString(input.publicId) } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.viewerReady !== undefined ? { viewerReady: Boolean(input.viewerReady) } : {}),
      ...(input.mobileReady !== undefined ? { mobileReady: Boolean(input.mobileReady) } : {}),
      ...(input.publishedUrl !== undefined ? { publishedUrl: cleanString(input.publishedUrl) } : {}),
      ...(input.qrUrl !== undefined ? { qrUrl: cleanString(input.qrUrl) } : {}),
      ...(input.analyticsEnabled !== undefined ? { analyticsEnabled: Boolean(input.analyticsEnabled) } : {}),
      ...(input.notes !== undefined ? { notes: cleanString(input.notes) } : {})
    }
  });
}

export async function archiveCaptureOutputAsset(captureJobId: string, assetId: string, tenantId: string) {
  return updateCaptureOutputAsset(captureJobId, assetId, tenantId, { status: 'archived' });
}

export async function getPublicCaptureJob(captureJobId: string) {
  const job = await getDb().captureJob.findUnique({
    where: { id: captureJobId },
    include: {
      outputAssets: {
        where: { status: 'published' },
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  if (!job || !['published', 'connected_to_crm'].includes(job.status)) {
    throw new AppError(404, 'CaptureJob publico no encontrado.');
  }

  return {
    id: job.id,
    title: job.title,
    clientName: job.clientName,
    projectType: job.projectType,
    vertical: job.vertical,
    status: job.status,
    publicUrl: job.publicUrl,
    qrUrl: job.qrUrl,
    outputAssets: job.outputAssets.map((asset: any) => ({
      id: asset.id,
      type: asset.type,
      format: asset.format,
      url: asset.publishedUrl || asset.url,
      viewerReady: asset.viewerReady,
      mobileReady: asset.mobileReady,
      isPremium3d: isPremium3dOutputType(asset.type),
      embeddable: isPremium3dOutputType(asset.type) && canEmbedPremium3dUrl(asset.publishedUrl || asset.url)
    }))
  };
}
