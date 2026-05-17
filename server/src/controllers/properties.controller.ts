// LOCAL STRING ENUMS PROPERTY CONTROLLER START
type PropertyType = string;
const PropertyType = {
  APARTMENT: "APARTMENT",
  HOUSE: "HOUSE",
  VILLA: "VILLA",
  PENTHOUSE: "PENTHOUSE",
  COMMERCIAL: "COMMERCIAL",
  OFFICE: "OFFICE",
  LAND: "LAND"
} as const;

type PropertyStatus = string;
const PropertyStatus = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  ARCHIVED: "ARCHIVED"
} as const;
// LOCAL STRING ENUMS PROPERTY CONTROLLER END
// SQLite compatible
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler.js';
import * as propertiesService from '../services/properties.service.js';

const hotspotSchema = z.object({
  label: z.string().trim().min(1, 'El hotspot necesita label.'),
  type: z.string(),
  position: z.record(z.unknown()),
  body: z.string().optional(),
  metric: z.string().optional(),
  targetSpaceId: z.string().optional()
});

const assetSchema = z.object({
  type: z.string(),
  url: z.string().trim().min(1, 'El asset necesita URL.'),
  thumbnail: z.string().optional(),
  format: z.string(),
  size: z.number().min(0).optional(),
  hotspots: z.array(hotspotSchema).optional()
});

const assetUpdateSchema = assetSchema.partial();

const spaceSchema = z.object({
  name: z.string().trim().min(1, 'La estancia necesita nombre.'),
  order: z.number().int().positive().optional(),
  status: z.string().optional(),
  dimensions: z.record(z.unknown()).nullable().optional(),
  assets: z.array(assetSchema).optional()
});

const spaceUpdateSchema = z.object({
  name: z.string().trim().min(1, 'La estancia necesita nombre.').optional(),
  order: z.number().int().positive().optional(),
  status: z.string().optional(),
  dimensions: z.record(z.unknown()).nullable().optional(),
  assets: z.array(assetSchema).optional()
});

const propertySchema = z.object({
  title: z.string().trim().min(2, 'El titulo debe tener al menos 2 caracteres.'),
  description: z.string().optional(),
  type: z.string().optional(),
  status: z.string().optional(),
  price: z.number().int().min(0).optional(),
  area: z.number().int().min(0).optional(),
  rooms: z.number().int().min(0).optional(),
  bathrooms: z.number().int().min(0).optional(),
  coverImage: z.string().optional(),
  panoramaUrl: z.string().optional(),
  address: z.string().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  password: z.string().optional(),
  spaces: z.array(spaceSchema).optional()
});

function parseOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function parsePropertyType(value: unknown): PropertyType | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  return (Object.values(PropertyType) as string[]).includes(value) ? value : undefined;
}

function parsePropertyStatus(value: unknown): PropertyStatus | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  return (Object.values(PropertyStatus) as string[]).includes(value) ? value : undefined;
}

export async function listProperties(request: Request, response: Response): Promise<void> {
  const filters = {
    q: typeof request.query.q === 'string' ? request.query.q : undefined,
    type: parsePropertyType(request.query.type),
    status: parsePropertyStatus(request.query.status),
    minPrice: parseOptionalNumber(request.query.minPrice),
    maxPrice: parseOptionalNumber(request.query.maxPrice),
    minArea: parseOptionalNumber(request.query.minArea),
    maxArea: parseOptionalNumber(request.query.maxArea)
  };

  if (!request.auth) {
    throw new AppError(401, 'Usuario no autenticado.');
  }

  const tenantId = request.auth!.tenantId;
  const data = await propertiesService.listProperties(filters, tenantId);

  response.status(200).json({
    success: true,
    data
  });
}

export async function getPropertyById(request: Request, response: Response): Promise<void> {
  const tenantId = request.auth?.tenantId;
  const data = await propertiesService.getPropertyById(request.params.id, tenantId);
  response.status(200).json({ success: true, data });
}

export async function unlockProperty(request: Request, response: Response): Promise<void> {
  const { password } = request.body as { password?: string };
  if (!password || typeof password !== 'string') {
    throw new AppError(400, 'Contraseña requerida.');
  }
  const data = await propertiesService.verifyPropertyPassword(request.params.id, password);
  response.status(200).json({ success: true, data });
}

export async function createProperty(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    if (!request.auth) {
      throw new AppError(401, 'Usuario no autenticado.');
    }

    const input = propertySchema.parse(request.body);
    const data = await propertiesService.createProperty(request.auth.tenantId, input);

    response.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

export async function incrementPropertyViews(request: Request, response: Response): Promise<void> {
  await propertiesService.incrementPropertyViews(request.params.id);
  response.status(204).end();
}

export async function getPropertyStats(request: Request, response: Response): Promise<void> {
  const data = await propertiesService.getTopProperties(6);
  response.status(200).json({ success: true, data });
}

export async function updateProperty(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    if (!request.auth) {
      throw new AppError(401, 'Usuario no autenticado.');
    }

    const input = propertySchema.parse(request.body);
    const data = await propertiesService.updateProperty(request.auth.tenantId, request.params.id, input);

    response.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

export async function listPropertySpaces(request: Request, response: Response): Promise<void> {
  if (!request.auth) {
    throw new AppError(401, 'Usuario no autenticado.');
  }

  const data = await propertiesService.listSpaces(request.auth!.tenantId, request.params.propertyId);

  response.status(200).json({
    success: true,
    data
  });
}

export async function createPropertySpace(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    if (!request.auth) {
      throw new AppError(401, 'Usuario no autenticado.');
    }

    const input = spaceSchema.parse(request.body);
    const data = await propertiesService.createSpace(request.auth.tenantId, request.params.propertyId, input as any);

    response.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

export async function updatePropertySpace(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    if (!request.auth) {
      throw new AppError(401, 'Usuario no autenticado.');
    }

    const input = spaceUpdateSchema.parse(request.body);
    const data = await propertiesService.updateSpace(request.auth.tenantId, request.params.propertyId, request.params.spaceId, input as any);

    response.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

export async function deletePropertySpace(request: Request, response: Response): Promise<void> {
  if (!request.auth) {
    throw new AppError(401, 'Usuario no autenticado.');
  }

  const data = await propertiesService.deleteSpace(request.auth!.tenantId, request.params.propertyId, request.params.spaceId);

  response.status(200).json({
    success: true,
    data
  });
}

export async function deleteProperty(request: Request, response: Response): Promise<void> {
  if (!request.auth) {
    throw new AppError(401, 'Usuario no autenticado.');
  }

  const data = await propertiesService.deleteProperty(request.auth!.tenantId, request.params.id);

  response.status(200).json({
    success: true,
    data
  });
}




export async function listSpaceAssets(request: Request, response: Response): Promise<void> {
  const data = await propertiesService.listAssets(
    request.auth!.tenantId,
    request.params.propertyId,
    request.params.spaceId
  );

  response.json({ success: true, data });
}

export async function createSpaceAsset(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const input = assetSchema.parse(request.body);
    const data = await propertiesService.createAsset(
      request.auth!.tenantId,
      request.params.propertyId,
      request.params.spaceId,
      input as any
    );

    response.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function updateSpaceAsset(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const input = assetUpdateSchema.parse(request.body);
    const data = await propertiesService.updateAsset(
      request.auth!.tenantId,
      request.params.propertyId,
      request.params.spaceId,
      request.params.assetId,
      input as any
    );

    response.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function deleteSpaceAsset(request: Request, response: Response): Promise<void> {
  const data = await propertiesService.deleteAsset(
    request.auth!.tenantId,
    request.params.propertyId,
    request.params.spaceId,
    request.params.assetId
  );

  response.json({ success: true, data });
}
