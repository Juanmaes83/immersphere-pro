import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';

type CloudinaryResourceType = 'image' | 'video' | 'raw' | 'auto';

interface StoreUploadMetadata {
  tenantId?: string | null;
  userId?: string | null;
}

interface StoredUpload {
  provider: 'cloudinary' | 'local';
  id: string;
  originalName: string;
  filename: string;
  mimeType: string;
  size: number;
  bytes: number;
  url: string;
  path: string;
  thumbnailUrl: string;
  resourceType: string;
  publicId: string | null;
  storageKey: string | null;
  width: number | null;
  height: number | null;
  format: string;
}

let configured = false;

function hasCloudinaryConfig(): boolean {
  return Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
}

function configureCloudinary(): void {
  if (configured || !hasCloudinaryConfig()) return;

  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true
  });

  configured = true;
}

function sanitizeFolderSegment(value: string | null | undefined): string {
  const normalized = String(value ?? 'unknown')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

  return normalized || 'unknown';
}

function getResourceType(file: Express.Multer.File): CloudinaryResourceType {
  const extension = path.extname(file.originalname).toLowerCase();

  if (file.mimetype.startsWith('image/')) return 'image';
  if (file.mimetype.startsWith('video/')) return 'video';

  if (['.splat', '.ply', '.glb'].includes(extension)) {
    return 'raw';
  }

  return 'auto';
}

function getFormat(file: Express.Multer.File, cloudinaryFormat?: string): string {
  if (cloudinaryFormat) return cloudinaryFormat.toLowerCase();

  const extension = path.extname(file.originalname).toLowerCase().replace('.', '');
  return extension || 'bin';
}

function buildImageThumbnailUrl(secureUrl: string): string {
  return secureUrl.replace('/upload/', '/upload/f_auto,q_auto,w_640/');
}

function buildVideoThumbnailUrl(publicId: string): string {
  return `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/video/upload/so_0,w_640,q_auto/${publicId}.jpg`;
}

function buildGlbThumbnailUrl(publicId: string): string {
  return `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/image/upload/f_jpg,q_auto,w_640/${publicId}.jpg`;
}

async function removeTempFile(filePath: string | undefined): Promise<void> {
  if (!filePath) return;

  try {
    await unlink(filePath);
  } catch {
    // El archivo temporal puede no existir si multer/storage cambia en el futuro.
  }
}

export async function storeUploadFile(file: Express.Multer.File, metadata: StoreUploadMetadata): Promise<StoredUpload> {
  const tenantFolder = sanitizeFolderSegment(metadata.tenantId);
  const originalFormat = getFormat(file);

  if (!hasCloudinaryConfig()) {
    const publicPath = `/uploads/${file.filename}`;

    return {
      provider: 'local',
      id: file.filename,
      originalName: file.originalname,
      filename: file.filename,
      mimeType: file.mimetype,
      size: file.size,
      bytes: file.size,
      url: publicPath,
      path: publicPath,
      thumbnailUrl: file.mimetype.startsWith('image/') ? publicPath : '',
      resourceType: 'local',
      publicId: null,
      storageKey: null,
      width: null,
      height: null,
      format: originalFormat
    };
  }

  configureCloudinary();

  const resourceType = getResourceType(file);
  const folder = `${env.CLOUDINARY_FOLDER}/${tenantFolder}`;

  try {
    const result = (await cloudinary.uploader.upload(file.path, {
      folder,
      resource_type: resourceType,
      use_filename: true,
      unique_filename: true,
      overwrite: false
    })) as any;

    const publicId = String(result.public_id ?? '');
    const secureUrl = String(result.secure_url ?? '');

    return {
      provider: 'cloudinary',
      id: String(result.asset_id ?? publicId),
      originalName: file.originalname,
      filename: file.filename,
      mimeType: file.mimetype,
      size: file.size,
      bytes: Number(result.bytes ?? file.size),
      url: secureUrl,
      path: secureUrl,
      thumbnailUrl:
        resourceType === 'image'
          ? buildImageThumbnailUrl(secureUrl)
          : resourceType === 'video'
            ? buildVideoThumbnailUrl(publicId)
            : path.extname(file.originalname).toLowerCase() === '.glb'
              ? buildGlbThumbnailUrl(publicId)
              : '',
      resourceType,
      publicId,
      storageKey: publicId,
      width: typeof result.width === 'number' ? result.width : null,
      height: typeof result.height === 'number' ? result.height : null,
      format: getFormat(file, result.format)
    };
  } finally {
    await removeTempFile(file.path);
  }
}
