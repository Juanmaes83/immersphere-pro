import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import {
  applyCaptureJobAiContentController,
  archiveCaptureJobController,
  createCaptureHotspotController,
  createCaptureInputAssetController,
  createCaptureJobController,
  createCaptureJobHotspotsFromAiController,
  createCaptureOutputAssetController,
  deleteCaptureHotspotController,
  deleteCaptureInputAssetController,
  deleteCaptureOutputAssetController,
  generateCaptureJobQrController,
  getCaptureJobAiRunController,
  getCaptureJobController,
  getPublicCaptureJobController,
  listCaptureHotspotsController,
  listCaptureJobAiRunsController,
  listCaptureJobsController,
  processCaptureJobAiController,
  updateCaptureHotspotController,
  updateCaptureInputAssetController,
  updateCaptureJobController,
  updateCaptureOutputAssetController,
  uploadCaptureInputAssetController
} from '../controllers/capture-jobs.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

export const captureJobsRoutes = Router();

const uploadDirectory = path.resolve(process.cwd(), 'uploads', 'capture-jobs');
mkdirSync(uploadDirectory, { recursive: true });

const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.mp4', '.mov', '.pdf']);
const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'application/pdf'
]);

function getSafeExtension(originalName: string): string {
  return path.extname(originalName).toLowerCase();
}

const storage = multer.diskStorage({
  destination: (_request, _file, callback) => {
    callback(null, uploadDirectory);
  },
  filename: (_request, file, callback) => {
    const extension = getSafeExtension(file.originalname) || '.bin';
    callback(null, `${Date.now()}-${randomUUID()}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 150 * 1024 * 1024
  },
  fileFilter: (_request, file, callback) => {
    const extension = getSafeExtension(file.originalname);
    if (!allowedExtensions.has(extension)) {
      callback(new Error('Extension no permitida para CaptureJob.'));
      return;
    }
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(new Error('Tipo de archivo no permitido para CaptureJob.'));
      return;
    }
    callback(null, true);
  }
});

type MulterMiddleware = (req: unknown, res: unknown, cb: (err?: unknown) => void) => void;
const rawUploadSingle = upload.single('file') as unknown as MulterMiddleware;

const uploadCaptureFile: RequestHandler = (request, response, next) => {
  rawUploadSingle(request, response, (err) => {
    if (err instanceof multer.MulterError) {
      next(new AppError(400, `Error de subida: ${err.message}`));
      return;
    }
    if (err instanceof Error) {
      next(new AppError(400, err.message));
      return;
    }
    next();
  });
};

captureJobsRoutes.get('/public/:captureJobId', getPublicCaptureJobController);

captureJobsRoutes.get('/', requireAuth, listCaptureJobsController);
captureJobsRoutes.post('/', requireAuth, createCaptureJobController);
captureJobsRoutes.get('/:captureJobId', requireAuth, getCaptureJobController);
captureJobsRoutes.put('/:captureJobId', requireAuth, updateCaptureJobController);
captureJobsRoutes.delete('/:captureJobId', requireAuth, archiveCaptureJobController);
captureJobsRoutes.post('/:captureJobId/qr', requireAuth, generateCaptureJobQrController);
captureJobsRoutes.post('/:captureJobId/ai/process', requireAuth, processCaptureJobAiController);
captureJobsRoutes.get('/:captureJobId/ai/runs', requireAuth, listCaptureJobAiRunsController);
captureJobsRoutes.get('/:captureJobId/ai/runs/:runId', requireAuth, getCaptureJobAiRunController);
captureJobsRoutes.post('/:captureJobId/ai/runs/:runId/apply-content', requireAuth, applyCaptureJobAiContentController);
captureJobsRoutes.post('/:captureJobId/ai/runs/:runId/create-hotspots', requireAuth, createCaptureJobHotspotsFromAiController);

captureJobsRoutes.get('/:captureJobId/hotspots', requireAuth, listCaptureHotspotsController);
captureJobsRoutes.post('/:captureJobId/hotspots', requireAuth, createCaptureHotspotController);
captureJobsRoutes.put('/:captureJobId/hotspots/:hotspotId', requireAuth, updateCaptureHotspotController);
captureJobsRoutes.delete('/:captureJobId/hotspots/:hotspotId', requireAuth, deleteCaptureHotspotController);

captureJobsRoutes.post('/:captureJobId/upload', requireAuth, uploadCaptureFile, uploadCaptureInputAssetController);

captureJobsRoutes.post('/:captureJobId/input-assets', requireAuth, createCaptureInputAssetController);
captureJobsRoutes.put('/:captureJobId/input-assets/:assetId', requireAuth, updateCaptureInputAssetController);
captureJobsRoutes.delete('/:captureJobId/input-assets/:assetId', requireAuth, deleteCaptureInputAssetController);

captureJobsRoutes.post('/:captureJobId/output-assets', requireAuth, createCaptureOutputAssetController);
captureJobsRoutes.put('/:captureJobId/output-assets/:assetId', requireAuth, updateCaptureOutputAssetController);
captureJobsRoutes.delete('/:captureJobId/output-assets/:assetId', requireAuth, deleteCaptureOutputAssetController);
