import crypto from 'node:crypto';
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
const INPUT_ASSET_TYPES = ['photo', 'video', 'panorama', 'floorplan', 'splat_external', 'document', 'other'] as const;
const INPUT_ASSET_QUALITY_STATUSES = ['pending', 'sufficient', 'needs_review', 'missing'] as const;
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
const PREMIUM_3D_PRIORITY = [
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
  captureAiProcessingRun: any;
  captureHotspot: any;
  captureLead: any;
};

const COMMERCIAL_BRIEF_TONES = ['professional', 'premium', 'direct', 'inspirational', 'technical'] as const;
const COMMERCIAL_BRIEF_CTA_GOALS = ['contact', 'book_visit', 'request_info', 'download', 'call'] as const;
const CAPTURE_HOTSPOT_STATUSES = ['draft', 'approved', 'published', 'archived'] as const;
const CAPTURE_HOTSPOT_TYPES = ['info', 'cta', 'navigation', 'feature', 'warning'] as const;
const CAPTURE_HOTSPOT_PRIORITIES = ['low', 'medium', 'high'] as const;
const CAPTURE_LEAD_INTEREST_TYPES = ['request_info', 'book_visit', 'investment', 'general'] as const;

export interface CaptureCommercialBriefInput {
  propertyType?: string;
  location?: string;
  surface?: string;
  rooms?: string;
  bathrooms?: string;
  priceRange?: string;
  targetAudience?: string;
  salesObjective?: string;
  keyBenefits?: string[];
  differentiators?: string[];
  tone?: string;
  ctaGoal?: string;
  brandNotes?: string;
  constraints?: string;
}

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
  commercialBrief?: CaptureCommercialBriefInput | null;
  riskLevel?: string;
  nextAction?: string;
  notes?: string;
  publicUrl?: string;
  qrUrl?: string;
}

export interface CaptureInputAssetInput {
  type: string;
  zone?: string;
  assetType?: string;
  filename?: string;
  url: string;
  publicId?: string;
  source?: string;
  format?: string;
  mimeType?: string;
  size?: number;
  sizeBytes?: number;
  status?: string;
  captureQualityStatus?: string;
  rightsStatus?: string;
  qualityScore?: number | null;
  notes?: string;
  sortOrder?: number;
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

export interface PublicCaptureLeadInput {
  name: string;
  email: string;
  phone?: string;
  message?: string;
  interestType?: string;
  consent: boolean;
  honeypot?: string;
}

export interface PublicCaptureLeadMeta {
  userAgent?: string;
  ip?: string;
}

export interface CaptureHotspotInput {
  label?: string;
  description?: string;
  roomOrZone?: string;
  hotspotType?: string;
  priority?: string;
  cta?: string;
  mediaSuggestion?: string;
  businessObjective?: string;
  position?: unknown;
  status?: string;
  isPublic?: boolean;
  sortOrder?: number;
}

function assertValue(value: string | undefined, allowed: readonly string[], label: string): void {
  if (value !== undefined && !allowed.includes(value)) {
    throw new AppError(400, `${label} invalido: ${value}. Valores permitidos: ${allowed.join(', ')}.`);
  }
}

function cleanString(value: string | undefined | null, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function truncateString(value: string, maxLength: number): string {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function normalizeEmail(value: string): string {
  return cleanString(value).toLowerCase();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function hashIp(value: string | undefined): string {
  const ip = cleanString(value);
  if (!ip) return '';
  return crypto.createHash('sha256').update(ip).digest('hex');
}

function cleanStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanString(typeof item === 'string' ? item : String(item ?? '')))
    .filter(Boolean)
    .slice(0, 12);
}

function toRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

function clampPercent(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function getSafePosition(value: unknown): unknown {
  const position = toRecord(value);
  if (Object.keys(position).length === 0) return null;
  const x = clampPercent(position.x);
  const y = clampPercent(position.y);
  if (x === null || y === null) return null;
  const mobileX = clampPercent(position.mobileX);
  const mobileY = clampPercent(position.mobileY);
  return {
    mode: 'overlay_2d',
    x,
    y,
    anchor: cleanString(position.anchor, 'center') || 'center',
    ...(mobileX !== null ? { mobileX } : {}),
    ...(mobileY !== null ? { mobileY } : {})
  };
}

function normalizeHotspotStatus(value: string | undefined, fallback = 'draft'): string {
  const clean = cleanString(value, fallback);
  return CAPTURE_HOTSPOT_STATUSES.includes(clean as any) ? clean : fallback;
}

function normalizeHotspotType(value: string | undefined): string {
  const clean = cleanString(value, 'info');
  return CAPTURE_HOTSPOT_TYPES.includes(clean as any) ? clean : 'info';
}

function normalizeHotspotPriority(value: string | undefined): string {
  const clean = cleanString(value, 'medium');
  return CAPTURE_HOTSPOT_PRIORITIES.includes(clean as any) ? clean : 'medium';
}

function normalizeInputAssetType(value: string | undefined): string {
  const clean = cleanString(value, 'other');
  return INPUT_ASSET_TYPES.includes(clean as any) ? clean : 'other';
}

function normalizeInputAssetQualityStatus(value: string | undefined): string {
  const clean = cleanString(value, 'pending');
  return INPUT_ASSET_QUALITY_STATUSES.includes(clean as any) ? clean : 'pending';
}

function normalizePublicFlag(status: string, isPublic: boolean | undefined): boolean {
  return status === 'published' && Boolean(isPublic);
}

export function normalizeCommercialBrief(input: CaptureCommercialBriefInput | null | undefined): CaptureCommercialBriefInput | null {
  if (!input || typeof input !== 'object') return null;
  const tone = cleanString(input.tone);
  const ctaGoal = cleanString(input.ctaGoal);
  return {
    propertyType: cleanString(input.propertyType),
    location: cleanString(input.location),
    surface: cleanString(input.surface),
    rooms: cleanString(input.rooms),
    bathrooms: cleanString(input.bathrooms),
    priceRange: cleanString(input.priceRange),
    targetAudience: cleanString(input.targetAudience),
    salesObjective: cleanString(input.salesObjective),
    keyBenefits: cleanStringArray(input.keyBenefits),
    differentiators: cleanStringArray(input.differentiators),
    tone: COMMERCIAL_BRIEF_TONES.includes(tone as (typeof COMMERCIAL_BRIEF_TONES)[number]) ? tone : 'professional',
    ctaGoal: COMMERCIAL_BRIEF_CTA_GOALS.includes(ctaGoal as (typeof COMMERCIAL_BRIEF_CTA_GOALS)[number]) ? ctaGoal : 'contact',
    brandNotes: cleanString(input.brandNotes),
    constraints: cleanString(input.constraints)
  };
}

export function getCommercialBriefCompleteness(input: CaptureCommercialBriefInput | null | undefined): number {
  const brief = normalizeCommercialBrief(input);
  if (!brief) return 0;
  let score = 0;
  if (brief.propertyType) score += 10;
  if (brief.location) score += 10;
  if (brief.targetAudience) score += 15;
  if (brief.salesObjective) score += 15;
  if ((brief.keyBenefits ?? []).length >= 2) score += 15;
  if ((brief.differentiators ?? []).length >= 1) score += 15;
  if (brief.ctaGoal) score += 10;
  if (brief.tone) score += 10;
  return Math.min(100, score);
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

function getPremium3dPriority(type: string): number {
  const index = PREMIUM_3D_PRIORITY.indexOf(type as (typeof PREMIUM_3D_PRIORITY)[number]);
  return index === -1 ? 99 : index;
}

function sortPremium3dOutputs<T extends { type: string; createdAt?: Date | string }>(assets: T[]): T[] {
  return [...assets].sort((a, b) => {
    const priorityDiff = getPremium3dPriority(a.type) - getPremium3dPriority(b.type);
    if (priorityDiff !== 0) return priorityDiff;
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });
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
  if ('commercialBrief' in input) {
    const commercialBrief = normalizeCommercialBrief(input.commercialBrief);
    data.commercialBrief = commercialBrief;
    data.commercialBriefCompleteness = getCommercialBriefCompleteness(commercialBrief);
    data.commercialBriefUpdatedAt = commercialBrief ? new Date() : null;
  }
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
      outputAssets: { orderBy: { createdAt: 'desc' } },
      hotspots: { where: { status: { not: 'archived' } }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }
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
    const q = filters.q.trim();
    where.OR = [
      { id: { contains: q, mode: 'insensitive' } },
      { title: { contains: q, mode: 'insensitive' } },
      { clientName: { contains: q, mode: 'insensitive' } },
      { projectType: { contains: q, mode: 'insensitive' } },
      { vertical: { contains: q, mode: 'insensitive' } },
      { publicUrl: { contains: q, mode: 'insensitive' } },
      { qrUrl: { contains: q, mode: 'insensitive' } },
      { nextAction: { contains: q, mode: 'insensitive' } },
      {
        outputAssets: {
          some: {
            OR: [
              { id: { contains: q, mode: 'insensitive' } },
              { type: { contains: q, mode: 'insensitive' } },
              { url: { contains: q, mode: 'insensitive' } },
              { publishedUrl: { contains: q, mode: 'insensitive' } }
            ]
          }
        }
      }
    ];
  }

  return getDb().captureJob.findMany({
    where,
    include: {
      property: { select: { id: true, title: true } },
      lead: { select: { id: true, email: true, status: true } },
      outputAssets: {
        where: { type: { in: [...PREMIUM_3D_OUTPUT_TYPES] } },
        orderBy: { createdAt: 'desc' }
      },
      hotspots: {
        where: { status: { not: 'archived' } },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
      },
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
      outputAssets: true,
      hotspots: true
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
      outputAssets: { orderBy: { createdAt: 'desc' } },
      hotspots: { where: { status: { not: 'archived' } }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }
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
      zone: truncateString(cleanString(input.zone), 120),
      assetType: normalizeInputAssetType(input.assetType || input.type),
      filename: cleanString(input.filename),
      url: cleanString(input.url),
      publicId: cleanString(input.publicId),
      source: cleanString(input.source, 'manual'),
      format: cleanString(input.format),
      mimeType: truncateString(cleanString(input.mimeType || input.format), 120),
      size: input.size ?? 0,
      sizeBytes: input.sizeBytes ?? input.size ?? 0,
      status: input.status ?? 'received',
      captureQualityStatus: normalizeInputAssetQualityStatus(input.captureQualityStatus),
      rightsStatus: cleanString(input.rightsStatus, 'unknown'),
      qualityScore: input.qualityScore ?? null,
      notes: truncateString(cleanString(input.notes), 1000),
      sortOrder: Math.max(0, Math.round(input.sortOrder ?? 0))
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
      ...(input.zone !== undefined ? { zone: truncateString(cleanString(input.zone), 120) } : {}),
      ...(input.assetType !== undefined ? { assetType: normalizeInputAssetType(input.assetType) } : {}),
      ...(input.filename !== undefined ? { filename: cleanString(input.filename) } : {}),
      ...(input.url !== undefined ? { url: cleanString(input.url) } : {}),
      ...(input.publicId !== undefined ? { publicId: cleanString(input.publicId) } : {}),
      ...(input.source !== undefined ? { source: cleanString(input.source, 'manual') } : {}),
      ...(input.format !== undefined ? { format: cleanString(input.format) } : {}),
      ...(input.mimeType !== undefined ? { mimeType: truncateString(cleanString(input.mimeType), 120) } : {}),
      ...(input.size !== undefined ? { size: input.size } : {}),
      ...(input.sizeBytes !== undefined ? { sizeBytes: input.sizeBytes } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.captureQualityStatus !== undefined ? { captureQualityStatus: normalizeInputAssetQualityStatus(input.captureQualityStatus) } : {}),
      ...(input.rightsStatus !== undefined ? { rightsStatus: cleanString(input.rightsStatus, 'unknown') } : {}),
      ...(input.qualityScore !== undefined ? { qualityScore: input.qualityScore } : {}),
      ...(input.notes !== undefined ? { notes: truncateString(cleanString(input.notes), 1000) } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: Math.max(0, Math.round(input.sortOrder)) } : {})
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

async function getCompletedAiRunForJob(captureJobId: string, runId: string, tenantId: string) {
  await getJobForTenant(captureJobId, tenantId);
  const run = await getDb().captureAiProcessingRun.findFirst({
    where: { id: runId, captureJobId, tenantId }
  });
  if (!run) throw new AppError(404, 'Run IA no encontrado.');
  if (run.status !== 'completed' || !run.result) {
    throw new AppError(400, 'Solo se pueden aplicar runs IA completados.');
  }
  return run;
}

function buildAppliedAiContent(run: any): Record<string, unknown> {
  const result = toRecord(run.result);
  const experience = toRecord(result.experienceStructure);
  const copy = toRecord(result.commercialCopy);
  const video = toRecord(result.videoScript);
  const qa = toRecord(result.qaRecommendations);
  const ctaSuggestions = cleanStringArray(copy.ctaSuggestions);
  const nextActions = Array.isArray(result.nextActions) ? result.nextActions.map((item: unknown) => {
    const action = toRecord(item);
    const priority = normalizeHotspotPriority(cleanString(action.priority));
    return {
      action: cleanString(action.action),
      priority,
      reason: cleanString(action.reason),
      status: 'draft'
    };
  }).filter((item: any) => item.action) : [];

  return {
    sourceRunId: run.id,
    commercialTitle: cleanString(experience.recommendedTitle),
    shortDescription: cleanString(copy.shortDescription),
    longDescription: cleanString(copy.longDescription),
    salesAngle: cleanString(copy.salesAngle),
    targetAudience: cleanString(copy.targetAudience),
    ctaPrimary: ctaSuggestions[0] ?? '',
    ctaSecondary: ctaSuggestions[1] ?? '',
    benefits: cleanStringArray(copy.propertyHighlights),
    videoHook: cleanString(video.hook),
    videoScriptSummary: cleanString(video.voiceover || video.closingCTA),
    nextActions,
    qaSummary: [
      ...cleanStringArray(qa.desktop).slice(0, 1),
      ...cleanStringArray(qa.mobile).slice(0, 1),
      ...cleanStringArray(qa.viewer).slice(0, 1)
    ].join(' ')
  };
}

export async function applyCaptureAiContent(captureJobId: string, runId: string, tenantId: string) {
  const run = await getCompletedAiRunForJob(captureJobId, runId, tenantId);
  return getDb().captureJob.update({
    where: { id: captureJobId },
    data: {
      appliedAiContent: buildAppliedAiContent(run),
      appliedAiContentUpdatedAt: new Date()
    },
    include: {
      property: { select: { id: true, title: true } },
      lead: { select: { id: true, email: true, status: true } },
      inputAssets: { orderBy: { createdAt: 'desc' } },
      outputAssets: { orderBy: { createdAt: 'desc' } },
      hotspots: { where: { status: { not: 'archived' } }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }
    }
  });
}

export async function createCaptureHotspotsFromAi(captureJobId: string, runId: string, tenantId: string) {
  const run = await getCompletedAiRunForJob(captureJobId, runId, tenantId);
  const result = toRecord(run.result);
  const suggested = Array.isArray(result.suggestedHotspots) ? result.suggestedHotspots : [];
  if (suggested.length === 0) throw new AppError(400, 'Este run no contiene hotspots sugeridos.');

  const created: unknown[] = [];
  let skipped = 0;
  for (const [index, item] of suggested.entries()) {
    const hotspot = toRecord(item);
    const label = cleanString(hotspot.label);
    const roomOrZone = cleanString(hotspot.roomOrZone);
    if (!label) {
      skipped += 1;
      continue;
    }
    const duplicate = await getDb().captureHotspot.findFirst({
      where: {
        captureJobId,
        tenantId,
        label,
        roomOrZone,
        status: { not: 'archived' }
      }
    });
    if (duplicate) {
      skipped += 1;
      continue;
    }
    created.push(await getDb().captureHotspot.create({
      data: {
        captureJobId,
        tenantId,
        sourceRunId: run.id,
        label,
        description: cleanString(hotspot.description),
        roomOrZone,
        hotspotType: normalizeHotspotType(cleanString(hotspot.hotspotType)),
        priority: normalizeHotspotPriority(cleanString(hotspot.priority)),
        cta: cleanString(hotspot.cta),
        mediaSuggestion: cleanString(hotspot.mediaSuggestion),
        businessObjective: cleanString(hotspot.businessObjective),
        status: 'draft',
        isPublic: false,
        sortOrder: index
      }
    }));
  }

  return { created, skipped };
}

export async function listCaptureHotspots(captureJobId: string, tenantId: string) {
  await getJobForTenant(captureJobId, tenantId);
  return getDb().captureHotspot.findMany({
    where: { captureJobId, tenantId, status: { not: 'archived' } },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
  });
}

export async function createCaptureHotspot(captureJobId: string, tenantId: string, input: CaptureHotspotInput) {
  await getJobForTenant(captureJobId, tenantId);
  const label = cleanString(input.label);
  if (!label) throw new AppError(400, 'label requerido.');
  const description = cleanString(input.description);
  if (!description) throw new AppError(400, 'description requerido.');
  const status = normalizeHotspotStatus(input.status);
  return getDb().captureHotspot.create({
    data: {
      captureJobId,
      tenantId,
      label,
      description,
      roomOrZone: cleanString(input.roomOrZone),
      hotspotType: normalizeHotspotType(input.hotspotType),
      priority: normalizeHotspotPriority(input.priority),
      cta: cleanString(input.cta),
      mediaSuggestion: cleanString(input.mediaSuggestion),
      businessObjective: cleanString(input.businessObjective),
      position: getSafePosition(input.position),
      status,
      isPublic: normalizePublicFlag(status, input.isPublic),
      sortOrder: Math.max(0, Math.round(input.sortOrder ?? 0))
    }
  });
}

export async function updateCaptureHotspot(captureJobId: string, hotspotId: string, tenantId: string, input: CaptureHotspotInput) {
  await getJobForTenant(captureJobId, tenantId);
  const existing = await getDb().captureHotspot.findFirst({ where: { id: hotspotId, captureJobId, tenantId } });
  if (!existing) throw new AppError(404, 'Hotspot no encontrado.');
  const status = normalizeHotspotStatus(input.status, existing.status);
  const isPublic = input.isPublic === undefined ? existing.isPublic : input.isPublic;
  return getDb().captureHotspot.update({
    where: { id: hotspotId },
    data: {
      ...(input.label !== undefined ? { label: cleanString(input.label) } : {}),
      ...(input.description !== undefined ? { description: cleanString(input.description) } : {}),
      ...(input.roomOrZone !== undefined ? { roomOrZone: cleanString(input.roomOrZone) } : {}),
      ...(input.hotspotType !== undefined ? { hotspotType: normalizeHotspotType(input.hotspotType) } : {}),
      ...(input.priority !== undefined ? { priority: normalizeHotspotPriority(input.priority) } : {}),
      ...(input.cta !== undefined ? { cta: cleanString(input.cta) } : {}),
      ...(input.mediaSuggestion !== undefined ? { mediaSuggestion: cleanString(input.mediaSuggestion) } : {}),
      ...(input.businessObjective !== undefined ? { businessObjective: cleanString(input.businessObjective) } : {}),
      ...(input.position !== undefined ? { position: getSafePosition(input.position) } : {}),
      ...(input.status !== undefined ? { status } : {}),
      ...((input.status !== undefined || input.isPublic !== undefined) ? { isPublic: normalizePublicFlag(status, isPublic) } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: Math.max(0, Math.round(input.sortOrder)) } : {})
    }
  });
}

export async function archiveCaptureHotspot(captureJobId: string, hotspotId: string, tenantId: string) {
  return updateCaptureHotspot(captureJobId, hotspotId, tenantId, { status: 'archived', isPublic: false });
}

function buildPublicAppliedAiContent(value: unknown): Record<string, unknown> | null {
  const content = toRecord(value);
  if (Object.keys(content).length === 0) return null;
  return {
    commercialTitle: cleanString(content.commercialTitle),
    shortDescription: cleanString(content.shortDescription),
    longDescription: cleanString(content.longDescription),
    salesAngle: cleanString(content.salesAngle),
    targetAudience: cleanString(content.targetAudience),
    ctaPrimary: cleanString(content.ctaPrimary),
    ctaSecondary: cleanString(content.ctaSecondary),
    benefits: cleanStringArray(content.benefits),
    videoHook: cleanString(content.videoHook),
    videoScriptSummary: cleanString(content.videoScriptSummary)
  };
}

export async function getPublicCaptureJob(captureJobId: string) {
  const job = await getDb().captureJob.findUnique({
    where: { id: captureJobId },
    include: {
      outputAssets: {
        where: { status: 'published' },
        orderBy: { createdAt: 'desc' }
      },
      hotspots: {
        where: { status: 'published', isPublic: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
      }
    }
  });

  if (!job || !['published', 'connected_to_crm'].includes(job.status)) {
    throw new AppError(404, 'CaptureJob publico no encontrado.');
  }

  const publicOutputAssets = sortPremium3dOutputs(job.outputAssets.filter((asset: any) => isPremium3dOutputType(asset.type)))
    .concat(job.outputAssets.filter((asset: any) => !isPremium3dOutputType(asset.type)));

  return {
    id: job.id,
    title: job.title,
    clientName: job.clientName,
    projectType: job.projectType,
    vertical: job.vertical,
    status: job.status,
    publicUrl: job.publicUrl,
    qrUrl: job.qrUrl,
    appliedAiContent: buildPublicAppliedAiContent(job.appliedAiContent),
    hotspots: job.hotspots.map((hotspot: any) => ({
      id: hotspot.id,
      label: hotspot.label,
      description: hotspot.description,
      roomOrZone: hotspot.roomOrZone,
      hotspotType: hotspot.hotspotType,
      priority: hotspot.priority,
      cta: hotspot.cta,
      mediaSuggestion: hotspot.mediaSuggestion,
      position: hotspot.position,
      sortOrder: hotspot.sortOrder
    })),
    outputAssets: publicOutputAssets.map((asset: any) => ({
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

export async function createPublicCaptureLead(
  captureJobId: string,
  input: PublicCaptureLeadInput,
  meta: PublicCaptureLeadMeta = {}
) {
  const job = await getDb().captureJob.findUnique({
    where: { id: captureJobId },
    select: { id: true, tenantId: true, status: true }
  });

  if (!job || !['published', 'connected_to_crm'].includes(job.status)) {
    throw new AppError(404, 'CaptureJob publico no encontrado.');
  }

  if (cleanString(input.honeypot)) {
    throw new AppError(400, 'Solicitud no valida.');
  }

  if (!input.consent) {
    throw new AppError(400, 'Debes aceptar el consentimiento de contacto.');
  }

  const name = truncateString(cleanString(input.name), 120);
  const email = truncateString(normalizeEmail(input.email), 160);
  const phone = truncateString(cleanString(input.phone), 40);
  const message = truncateString(cleanString(input.message), 1000);
  const requestedInterestType = cleanString(input.interestType, 'general');
  const interestType = CAPTURE_LEAD_INTEREST_TYPES.includes(requestedInterestType as (typeof CAPTURE_LEAD_INTEREST_TYPES)[number])
    ? requestedInterestType
    : 'general';

  if (name.length < 2) throw new AppError(400, 'Nombre requerido.');
  if (!isValidEmail(email)) throw new AppError(400, 'Email no valido.');
  if (phone && phone.length < 3) throw new AppError(400, 'Telefono no valido.');

  const duplicateWindowStart = new Date(Date.now() - 10 * 60 * 1000);
  const recentLead = await getDb().captureLead.findFirst({
    where: {
      captureJobId: job.id,
      email,
      createdAt: { gte: duplicateWindowStart }
    },
    select: { id: true }
  });

  if (recentLead) {
    throw new AppError(429, 'Ya hemos recibido una solicitud reciente con este email.');
  }

  await getDb().captureLead.create({
    data: {
      captureJobId: job.id,
      tenantId: job.tenantId,
      name,
      email,
      phone,
      message,
      interestType,
      source: 'capture_public',
      status: 'new',
      userAgent: truncateString(cleanString(meta.userAgent), 300),
      ipHash: hashIp(meta.ip),
      consent: true
    }
  });

  return {
    success: true,
    message: 'Solicitud recibida. Te contactaremos pronto.'
  };
}
