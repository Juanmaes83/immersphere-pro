import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { Router, type Request, type Response, type NextFunction, type RequestHandler } from 'express';
import multer from 'multer';
import { uploadAsset } from '../controllers/uploads.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const uploadDirectory = path.resolve(process.cwd(), 'uploads');

mkdirSync(uploadDirectory, { recursive: true });

const allowedExtensions = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.mp4',
  '.webm',
  '.splat',
  '.ply',
  '.glb'
]);

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'model/gltf-binary',
  'model/gltf+json',
  'application/octet-stream',
  'text/plain'
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
    fileSize: 100 * 1024 * 1024
  },
  fileFilter: (_request, file, callback) => {
    const extension = getSafeExtension(file.originalname);

    if (!allowedExtensions.has(extension)) {
      callback(new Error('Extension de archivo no permitida.'));
      return;
    }

    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(new Error('Tipo de archivo no permitido.'));
      return;
    }

    callback(null, true);
  }
});

const rawUploadSingle = upload.single('file');

function uploadSingleFile(request: Request, response: Response, next: NextFunction): void {
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
}

export const uploadsRoutes = Router();

uploadsRoutes.post('/', requireAuth, uploadSingleFile as RequestHandler, uploadAsset);
