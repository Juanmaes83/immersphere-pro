import { unlink } from 'node:fs/promises';
import type { Request, Response } from 'express';
import { storeUploadFile } from '../services/cloudinary.service.js';
import { checkTenantStorageQuota } from '../services/quota.service.js';

type UploadRequest = Request & {
  file?: Express.Multer.File;
};

async function safeDeleteTempFile(filePath: string | undefined): Promise<void> {
  if (!filePath) return;

  try {
    await unlink(filePath);
  } catch {
    // silencioso — el archivo puede no existir si ya fue eliminado
  }
}

export async function uploadAsset(request: UploadRequest, response: Response): Promise<void> {
  const file = request.file;

  if (!file) {
    response.status(400).json({
      success: false,
      error: 'Archivo no proporcionado.'
    });
    return;
  }

  const tenantId = request.auth?.tenantId ?? null;
  const userId = request.auth?.userId ?? null;

  if (tenantId) {
    const incomingMb = Math.ceil(file.size / (1024 * 1024));

    try {
      const quota = await checkTenantStorageQuota(tenantId, incomingMb);

      if (!quota.allowed) {
        await safeDeleteTempFile(file.path);
        response.status(403).json({
          success: false,
          error: `Cuota de almacenamiento superada. Plan ${quota.plan}: limite ${quota.quotaMb} MB, usado ${Math.round(quota.usedMb)} MB, archivo ${incomingMb} MB.`
        });
        return;
      }
    } catch {
      // Si el servicio de cuota falla, no bloqueamos la subida
    }
  }

  try {
    const storedUpload = await storeUploadFile(file, { tenantId, userId });

    response.status(201).json({
      success: true,
      data: {
        ...storedUpload,
        uploadedBy: userId,
        tenantId
      }
    });
  } catch (err) {
    await safeDeleteTempFile(file.path);
    const message = err instanceof Error ? err.message : 'No se ha podido subir el archivo.';
    response.status(500).json({
      success: false,
      error: message
    });
  }
}
