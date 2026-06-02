import { unlink } from 'node:fs/promises';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler.js';
import { storeUploadFile } from '../services/cloudinary.service.js';
import { checkTenantStorageQuota } from '../services/quota.service.js';
import {
  archiveCaptureJob,
  archiveCaptureOutputAsset,
  createCaptureInputAsset,
  createCaptureJob,
  createCaptureOutputAsset,
  generateCaptureJobQr,
  getCaptureJob,
  getPublicCaptureJob,
  listCaptureJobs,
  markCaptureInputAssetReplaced,
  updateCaptureInputAsset,
  updateCaptureJob,
  updateCaptureOutputAsset,
  type CaptureInputAssetInput,
  type CaptureJobInput,
  type CaptureOutputAssetInput
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
  riskLevel: z.string().trim().optional(),
  nextAction: z.string().optional(),
  notes: z.string().optional(),
  publicUrl: z.string().trim().optional(),
  qrUrl: z.string().trim().optional()
});

const captureJobUpdateSchema = captureJobSchema.partial();

const inputAssetSchema = z.object({
  type: z.string().trim().min(1, 'type requerido.'),
  filename: z.string().trim().optional(),
  url: z.string().trim().min(1, 'url requerida.'),
  publicId: z.string().trim().optional(),
  source: z.string().trim().optional(),
  format: z.string().trim().optional(),
  size: z.number().int().min(0).optional(),
  status: z.string().trim().optional(),
  rightsStatus: z.string().trim().optional(),
  qualityScore: z.number().int().min(0).max(100).nullable().optional(),
  notes: z.string().optional()
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
      filename: storedUpload.originalName,
      url: storedUpload.url,
      publicId: storedUpload.publicId ?? '',
      source: String(request.body?.source || 'upload'),
      format: storedUpload.format,
      size: storedUpload.bytes,
      status: 'received',
      rightsStatus: String(request.body?.rightsStatus || 'unknown'),
      notes: String(request.body?.notes || '')
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
