import type { Request, Response } from 'express';
import { storeUploadFile } from '../services/cloudinary.service.js';

type UploadRequest = Request & {
  file?: Express.Multer.File;
};

export async function uploadAsset(request: UploadRequest, response: Response): Promise<void> {
  const file = request.file;

  if (!file) {
    response.status(400).json({
      success: false,
      error: 'Archivo no proporcionado.'
    });
    return;
  }

  try {
    const storedUpload = await storeUploadFile(file, {
      tenantId: request.auth?.tenantId ?? null,
      userId: request.auth?.userId ?? null
    });

    response.status(201).json({
      success: true,
      data: {
        ...storedUpload,
        uploadedBy: request.auth?.userId ?? null,
        tenantId: request.auth?.tenantId ?? null
      }
    });
  } catch {
    response.status(500).json({
      success: false,
      error: 'No se ha podido subir el archivo.'
    });
  }
}
