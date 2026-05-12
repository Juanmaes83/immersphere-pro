import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import { uploadAsset } from '../controllers/uploads.controller.js';
import { requireAuth } from '../middleware/auth.js';

const uploadDirectory = path.resolve(process.cwd(), 'uploads');

mkdirSync(uploadDirectory, { recursive: true });

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'application/octet-stream'
]);

const storage = multer.diskStorage({
  destination: (_request, _file, callback) => {
    callback(null, uploadDirectory);
  },
  filename: (_request, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase() || '.bin';
    callback(null, `${Date.now()}-${randomUUID()}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024
  },
  fileFilter: (_request, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(new Error('Tipo de archivo no permitido.'));
      return;
    }

    callback(null, true);
  }
});

const uploadSingleFile = upload.single('file') as unknown as RequestHandler;

export const uploadsRoutes = Router();

uploadsRoutes.post('/', requireAuth, uploadSingleFile, uploadAsset);
