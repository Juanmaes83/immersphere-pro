import { unlink } from 'node:fs/promises';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler.js';
import { storeUploadFile } from '../services/cloudinary.service.js';
import { checkTenantStorageQuota } from '../services/quota.service.js';
import {
  cancelCaptureAiProcessingRun,
  getCaptureAiUsageSummary,
  getCaptureAiProcessingRun,
  listCaptureAiProcessingRuns,
  processCaptureJobWithAi,
  retryCaptureAiProcessingRun
} from '../services/capture-ai-processing.service.js';
import {
  applyCaptureAiContent,
  archiveCaptureJob,
  archiveCaptureHotspot,
  archiveCaptureOutputAsset,
  createCaptureHotspot,
  createCaptureInputAsset,
  createCaptureJob,
  createPublicCaptureLead,
  createCaptureOutputAsset,
  createCaptureHotspotsFromAi,
  generateCaptureJobQr,
  getCaptureJob,
  getPublicCaptureJob,
  listCaptureHotspots,
  listCaptureJobs,
  markCaptureInputAssetReplaced,
  updateCaptureHotspot,
  updateCaptureInputAsset,
  updateCaptureJob,
  updateCaptureOutputAsset,
  type CaptureHotspotInput,
  type CaptureInputAssetInput,
  type CaptureJobInput,
  type CaptureOutputAssetInput,
  type PublicCaptureLeadInput
} from '../services/capture-jobs.service.js';

type UploadRequest = Request & {
  file?: Express.Multer.File;
};

const captureJobSchema = z.object({
  leadId: z.string().trim().min(1).nullable().optional(),
  propertyId: z.string().trim().min(1).nullable().optional(),
  title: z.string().trim().min(2, 'title debe tener al menos 2 caracteres.'),
  clientName: z.string().trim().min(2, 'clientName debe tener al menos 2 caracteres.'),
  projectType: z.string().trim().optional(),
  vertical: z.string().trim().optional(),
  status: z.string().trim().optional(),
  priority: z.string().trim().optional(),
  source: z.string().trim().optional(),
  assignedTo: z.string().trim().optional(),
  dueDate: z.string().trim().nullable().optional(),
  estimatedCost: z.number().int().min(0).nullable().optional(),
  estimatedHours: z.number().int().min(0).nullable().optional(),
  commercialValue: z.number().int().min(0).nullable().optional(),
  commercialBrief: z.object({
    propertyType: z.string().optional(),
    location: z.string().optional(),
    surface: z.string().optional(),
    rooms: z.string().optional(),
    bathrooms: z.string().optional(),
    priceRange: z.string().optional(),
    targetAudience: z.string().optional(),
    salesObjective: z.string().optional(),
    keyBenefits: z.array(z.string()).optional(),
    differentiators: z.array(z.string()).optional(),
    tone: z.string().optional(),
    ctaGoal: z.string().optional(),
    brandNotes: z.string().optional(),
    constraints: z.string().optional()
  }).nullable().optional(),
  riskLevel: z.string().trim().optional(),
  nextAction: z.string().optional(),
  notes: z.string().optional(),
  publicUrl: z.string().trim().optional(),
  qrUrl: z.string().trim().optional()
});

const captureJobUpdateSchema = captureJobSchema.partial();

const inputAssetSchema = z.object({
  type: z.string().trim().min(1, 'type requerido.'),
  zone: z.string().trim().max(120).optional(),
  assetType: z.enum(['photo', 'video', 'panorama', 'floorplan', 'splat_external', 'document', 'other']).optional(),
  filename: z.string().trim().optional(),
  url: z.string().trim().min(1, 'url requerida.'),
  publicId: z.string().trim().optional(),
  source: z.string().trim().optional(),
  format: z.string().trim().optional(),
  mimeType: z.string().trim().optional(),
  size: z.number().int().min(0).optional(),
  sizeBytes: z.number().int().min(0).optional(),
  status: z.string().trim().optional(),
  captureQualityStatus: z.enum(['pending', 'sufficient', 'needs_review', 'missing']).optional(),
  rightsStatus: z.string().trim().optional(),
  qualityScore: z.number().int().min(0).max(100).nullable().optional(),
  notes: z.string().max(1000).optional(),
  sortOrder: z.number().int().min(0).optional()
});

const inputAssetUpdateSchema = inputAssetSchema.partial();

const outputAssetSchema = z.object({
  type: z.string().trim().min(1, 'type requerido.'),
  format: z.string().trim().optional(),
  url: z.string().trim().min(1, 'url requerida.'),
  publicId: z.string().trim().optional(),
  status: z.string().trim().optional(),
  viewerReady: z.boolean().optional(),
  mobileReady: z.boolean().optional(),
  publishedUrl: z.string().trim().optional(),
  qrUrl: z.string().trim().optional(),
  analyticsEnabled: z.boolean().optional(),
  notes: z.string().optional()
});

const outputAssetUpdateSchema = outputAssetSchema.partial();

const hotspotSchema = z.object({
  label: z.string().trim().min(1, 'label requerido.').optional(),
  description: z.string().trim().min(1, 'description requerido.').optional(),
  roomOrZone: z.string().trim().optional(),
  hotspotType: z.enum(['info', 'cta', 'navigation', 'feature', 'warning']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  cta: z.string().trim().optional(),
  mediaSuggestion: z.string().trim().optional(),
  businessObjective: z.string().trim().optional(),
  position: z.record(z.unknown()).nullable().optional(),
  status: z.enum(['draft', 'approved', 'published', 'archived']).optional(),
  isPublic: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional()
});

const hotspotCreateSchema = hotspotSchema.extend({
  label: z.string().trim().min(1, 'label requerido.'),
  description: z.string().trim().min(1, 'description requerido.')
});

const hotspotUpdateSchema = hotspotSchema.partial();

const publicCaptureLeadSchema = z.object({
  name: z.string().trim().min(2, 'Nombre requerido.').max(120),
  email: z.string().trim().email('Email no valido.').max(160),
  phone: z.string().trim().min(3).max(40).optional().or(z.literal('')),
  message: z.string().trim().max(1000).optional().or(z.literal('')),
  interestType: z.enum(['request_info', 'book_visit', 'investment', 'general']).optional(),
  consent: z.literal(true, { errorMap: () => ({ message: 'Consentimiento requerido.' }) }),
  honeypot: z.string().trim().max(200).optional()
});

async function safeDeleteTempFile(filePath: string | undefined): Promise<void> {
  if (!filePath) return;
  try {
    await unlink(filePath);
  } catch {
    // Temporary file may already be gone after Cloudinary/local storage handling.
  }
}

function requireTenantUser(request: Request): { tenantId: string; userId: string } {
  const tenantId = request.auth?.tenantId;
  const userId = request.auth?.userId;
  if (!tenantId || !userId) throw new AppError(401, 'Autenticacion requerida.');
  return { tenantId, userId };
}

export async function listCaptureJobsController(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const { tenantId } = requireTenantUser(request);
    const { q, status, priority, riskLevel } = request.query as Record<string, string | undefined>;
    const data = await listCaptureJobs(tenantId, { q, status, priority, riskLevel });
    response.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function createCaptureJobController(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const { tenantId, userId } = requireTenantUser(request);
    const input = captureJobSchema.parse(request.body) as CaptureJobInput;
    const data = await createCaptureJob(tenantId, userId, input);
    response.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getCaptureJobController(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const { tenantId } = requireTenantUser(request);
    const data = await getCaptureJob(request.params.captureJobId, tenantId);
    response.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function updateCaptureJobController(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const { tenantId } = requireTenantUser(request);
    const input = captureJobUpdateSchema.parse(request.body) as Partial<CaptureJobInput>;
    const data = await updateCaptureJob(request.params.captureJobId, tenantId, input);
    response.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function archiveCaptureJobController(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const { tenantId } = requireTenantUser(request);
    const data = await archiveCaptureJob(request.params.captureJobId, tenantId);
    response.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function generateCaptureJobQrController(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const { tenantId } = requireTenantUser(request);
    const data = await generateCaptureJobQr(request.params.captureJobId, tenantId);
    response.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function createCaptureInputAssetController(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const { tenantId } = requireTenantUser(request);
    const input = inputAssetSchema.parse(request.body) as CaptureInputAssetInput;
    const data = await createCaptureInputAsset(request.params.captureJobId, tenantId, input);
    response.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function updateCaptureInputAssetController(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const { tenantId } = requireTenantUser(request);
    const input = inputAssetUpdateSchema.parse(request.body) as Partial<CaptureInputAssetInput>;
    const data = await updateCaptureInputAsset(request.params.captureJobId, request.params.assetId, tenantId, input);
    response.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function deleteCaptureInputAssetController(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const { tenantId } = requireTenantUser(request);
    const data = await markCaptureInputAssetReplaced(request.params.captureJobId, request.params.assetId, tenantId);
    response.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function uploadCaptureInputAssetController(request: UploadRequest, response: Response, next: NextFunction): Promise<void> {
  const file = request.file;
  try {
    const { tenantId, userId } = requireTenantUser(request);
    if (!file) throw new AppError(400, 'Archivo no proporcionado.');

    const incomingMb = Math.ceil(file.size / (1024 * 1024));
    const quota = await checkTenantStorageQuota(tenantId, incomingMb);
    if (!quota.allowed) {
      await safeDeleteTempFile(file.path);
      throw new AppError(403, `Cuota de almacenamiento superada. Plan ${quota.plan}: limite ${quota.quotaMb} MB, usado ${Math.round(quota.usedMb)} MB, archivo ${incomingMb} MB.`);
    }

    const storedUpload = await storeUploadFile(file, { tenantId, userId });
    const input: CaptureInputAssetInput = {
      type: String(request.body?.type || storedUpload.resourceType || 'file'),
      zone: String(request.body?.zone || ''),
      assetType: String(request.body?.assetType || request.body?.type || ''),
      filename: storedUpload.originalName,
      url: storedUpload.url,
      publicId: storedUpload.publicId ?? '',
      source: String(request.body?.source || 'upload'),
      format: storedUpload.format,
      mimeType: storedUpload.mimeType,
      size: storedUpload.bytes,
      sizeBytes: storedUpload.bytes,
      status: 'received',
      captureQualityStatus: String(request.body?.captureQualityStatus || 'pending'),
      rightsStatus: String(request.body?.rightsStatus || 'unknown'),
      notes: String(request.body?.notes || ''),
      sortOrder: Number.isFinite(Number(request.body?.sortOrder)) ? Number(request.body?.sortOrder) : 0
    };
    const asset = await createCaptureInputAsset(request.params.captureJobId, tenantId, input);
    response.status(201).json({ success: true, data: { upload: storedUpload, asset } });
  } catch (error) {
    if (file) await safeDeleteTempFile(file.path);
    next(error);
  }
}

export async function createCaptureOutputAssetController(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const { tenantId } = requireTenantUser(request);
    const input = outputAssetSchema.parse(request.body) as CaptureOutputAssetInput;
    const data = await createCaptureOutputAsset(request.params.captureJobId, tenantId, input);
    response.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function updateCaptureOutputAssetController(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const { tenantId } = requireTenantUser(request);
    const input = outputAssetUpdateSchema.parse(request.body) as Partial<CaptureOutputAssetInput>;
    const data = await updateCaptureOutputAsset(request.params.captureJobId, request.params.assetId, tenantId, input);
    response.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function deleteCaptureOutputAssetController(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const { tenantId } = requireTenantUser(request);
    const data = await archiveCaptureOutputAsset(request.params.captureJobId, request.params.assetId, tenantId);
    response.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getPublicCaptureJobController(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const data = await getPublicCaptureJob(request.params.captureJobId);
    response.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

function getRequestIp(request: Request): string {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim() ?? '';
  return request.ip || request.socket.remoteAddress || '';
}

export async function createPublicCaptureLeadController(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const input = publicCaptureLeadSchema.parse(request.body) as PublicCaptureLeadInput;
    const data = await createPublicCaptureLead(request.params.captureJobId, input, {
      userAgent: request.headers['user-agent'],
      ip: getRequestIp(request)
    });
    response.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function processCaptureJobAiController(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const { tenantId, userId } = requireTenantUser(request);
    const data = await processCaptureJobWithAi(request.params.captureJobId, tenantId, userId);
    response.status(202).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getCaptureAiUsageController(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const { tenantId } = requireTenantUser(request);
    const data = await getCaptureAiUsageSummary(tenantId);
    response.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function listCaptureJobAiRunsController(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const { tenantId } = requireTenantUser(request);
    const data = await listCaptureAiProcessingRuns(request.params.captureJobId, tenantId);
    response.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getCaptureJobAiRunController(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const { tenantId } = requireTenantUser(request);
    const data = await getCaptureAiProcessingRun(request.params.captureJobId, request.params.runId, tenantId);
    response.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function cancelCaptureJobAiRunController(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const { tenantId } = requireTenantUser(request);
    const data = await cancelCaptureAiProcessingRun(request.params.captureJobId, request.params.runId, tenantId);
    response.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function retryCaptureJobAiRunController(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const { tenantId, userId } = requireTenantUser(request);
    const data = await retryCaptureAiProcessingRun(request.params.captureJobId, request.params.runId, tenantId, userId);
    response.status(202).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function applyCaptureJobAiContentController(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const { tenantId } = requireTenantUser(request);
    const data = await applyCaptureAiContent(request.params.captureJobId, request.params.runId, tenantId);
    response.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function createCaptureJobHotspotsFromAiController(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const { tenantId } = requireTenantUser(request);
    const data = await createCaptureHotspotsFromAi(request.params.captureJobId, request.params.runId, tenantId);
    response.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function listCaptureHotspotsController(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const { tenantId } = requireTenantUser(request);
    const data = await listCaptureHotspots(request.params.captureJobId, tenantId);
    response.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function createCaptureHotspotController(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const { tenantId } = requireTenantUser(request);
    const input = hotspotCreateSchema.parse(request.body) as CaptureHotspotInput;
    const data = await createCaptureHotspot(request.params.captureJobId, tenantId, input);
    response.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function updateCaptureHotspotController(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const { tenantId } = requireTenantUser(request);
    const input = hotspotUpdateSchema.parse(request.body) as CaptureHotspotInput;
    const data = await updateCaptureHotspot(request.params.captureJobId, request.params.hotspotId, tenantId, input);
    response.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function deleteCaptureHotspotController(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const { tenantId } = requireTenantUser(request);
    const data = await archiveCaptureHotspot(request.params.captureJobId, request.params.hotspotId, tenantId);
    response.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}
