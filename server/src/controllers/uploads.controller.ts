import type { Request, Response } from 'express';

type UploadRequest = Request & {
  file?: Express.Multer.File;
};

export function uploadAsset(request: UploadRequest, response: Response): void {
  const file = request.file;

  if (!file) {
    response.status(400).json({
      success: false,
      error: 'Archivo no proporcionado.'
    });
    return;
  }

  const publicPath = `/uploads/${file.filename}`;

  response.status(201).json({
    success: true,
    data: {
      id: file.filename,
      originalName: file.originalname,
      filename: file.filename,
      mimeType: file.mimetype,
      size: file.size,
      url: publicPath,
      path: publicPath,
      uploadedBy: request.auth?.userId ?? null,
      tenantId: request.auth?.tenantId ?? null
    }
  });
}
