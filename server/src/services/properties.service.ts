// LOCAL STRING ENUMS PROPERTIES START
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

type HotspotType = string;
const HotspotType = {
  INFO: "INFO",
  CTA: "CTA",
  MEASUREMENT: "MEASUREMENT",
  NAVIGATION: "NAVIGATION"
} as const;

type AssetType = string;
const AssetType = {
  PANORAMA_360: "PANORAMA_360",
  GAUSSIAN_SPLAT: "GAUSSIAN_SPLAT",
  IMAGE: "IMAGE",
  VIDEO: "VIDEO"
} as const;

type AssetFormat = string;
const AssetFormat = {
  JPG: "JPG",
  JPEG: "JPEG",
  PNG: "PNG",
  WEBP: "WEBP",
  MP4: "MP4",
  SPLAT: "SPLAT",
  PLY: "PLY"
} as const;
// LOCAL STRING ENUMS PROPERTIES END
import type { Prisma } from '@prisma/client';
import { prisma } from '../index.js';
import { AppError } from '../middleware/errorHandler.js';

interface PropertyFilters {
  q?: string;
  type?: PropertyType;
  minPrice?: number;
  maxPrice?: number;
  minArea?: number;
  maxArea?: number;
  status?: PropertyStatus;
}

interface HotspotInput {
  label: string;
  type: HotspotType;
  position: unknown;
  body?: string;
  metric?: string;
}

interface AssetInput {
  type: AssetType;
  url: string;
  thumbnail?: string;
  format: AssetFormat;
  size?: number;
  hotspots?: HotspotInput[];
}

interface SpaceInput {
  name: string;
  order?: number;
  status?: string;
  dimensions?: unknown;
  assets?: AssetInput[];
}

interface PropertyInput {
  title: string;
  description?: string;
  type?: PropertyType;
  status?: PropertyStatus;
  price?: number;
  area?: number;
  rooms?: number;
  bathrooms?: number;
  coverImage?: string;
  panoramaUrl?: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  spaces?: SpaceInput[];
}

const propertyInclude = {
  spaces: {
    orderBy: { order: 'asc' as const },
    include: {
      assets: {
        include: {
          hotspots: true
        }
      }
    }
  },
  _count: {
    select: { leads: true }
  }
};

const spaceInclude = {
  assets: {
    include: {
      hotspots: true
    }
  }
};

function buildPropertyWhere(filters: PropertyFilters, tenantId?: string): Prisma.PropertyWhereInput {
  const where: Prisma.PropertyWhereInput = {};

  if (tenantId) {
    where.tenantId = tenantId;
  }

  if (filters.status) {
    where.status = filters.status;
  } else if (!tenantId) {
    where.status = PropertyStatus.PUBLISHED;
  }

  if (filters.type) {
    where.type = filters.type;
  }

  if (filters.q) {
    where.OR = [
      { title: { contains: filters.q } },
      { description: { contains: filters.q } }
    ];
  }

  if (
    filters.minPrice !== undefined ||
    filters.maxPrice !== undefined ||
    filters.minArea !== undefined ||
    filters.maxArea !== undefined
  ) {
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      where.price = {};
      if (filters.minPrice !== undefined) where.price.gte = filters.minPrice;
      if (filters.maxPrice !== undefined) where.price.lte = filters.maxPrice;
    }

    if (filters.minArea !== undefined || filters.maxArea !== undefined) {
      where.area = {};
      if (filters.minArea !== undefined) where.area.gte = filters.minArea;
      if (filters.maxArea !== undefined) where.area.lte = filters.maxArea;
    }
  }

  return where;
}

function normalizeSpaceStatus(status: unknown): string {
  return String(status ?? '').toUpperCase() === 'HIDDEN' ? 'HIDDEN' : 'ACTIVE';
}

function buildAssetsCreate(assets: AssetInput[] | undefined) {
  return (assets ?? []).map((asset) => ({
    type: asset.type,
    url: asset.url,
    thumbnail: asset.thumbnail ?? '',
    format: asset.format,
    size: asset.size ?? 0,
    hotspots: {
      create: (asset.hotspots ?? []).map((hotspot) => ({
        label: hotspot.label,
        type: hotspot.type,
        position: JSON.stringify(hotspot.position ?? { x: 50, y: 50 }),
        body: hotspot.body ?? '',
        metric: hotspot.metric ?? ''
      }))
    }
  }));
}

function buildSpacesCreate(spaces: SpaceInput[] | undefined): Prisma.SpaceCreateWithoutPropertyInput[] {
  if (!spaces?.length) return [];

  return spaces.map((space, index) => ({
    name: space.name,
    order: space.order ?? index + 1,
    status: normalizeSpaceStatus(space.status),
    dimensions: space.dimensions == null ? null : JSON.stringify(space.dimensions),
    assets: {
      create: buildAssetsCreate(space.assets)
    }
  }));
}

export async function listProperties(filters: PropertyFilters, tenantId?: string) {
  return prisma.property.findMany({
    where: buildPropertyWhere(filters, tenantId),
    include: propertyInclude,
    orderBy: { createdAt: 'desc' }
  });
}

export async function getPropertyById(propertyId: string, tenantId?: string) {
  const property = await prisma.property.findFirst({
    where: tenantId
      ? { id: propertyId, tenantId }
      : { id: propertyId, status: PropertyStatus.PUBLISHED },
    include: propertyInclude
  });

  if (!property) {
    throw new AppError(404, 'Propiedad no encontrada.');
  }

  return property;
}



async function assertTenantProperty(tenantId: string, propertyId: string) {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, tenantId },
    select: { id: true }
  });

  if (!property) {
    throw new AppError(404, 'Propiedad no encontrada.');
  }

  return property;
}

async function assertTenantSpace(tenantId: string, propertyId: string, spaceId: string) {
  const space = await prisma.space.findFirst({
    where: {
      id: spaceId,
      propertyId,
      property: { tenantId }
    },
    select: { id: true }
  });

  if (!space) {
    throw new AppError(404, 'Estancia no encontrada.');
  }

  return space;
}

export async function listSpaces(tenantId: string, propertyId: string) {
  await assertTenantProperty(tenantId, propertyId);

  return prisma.space.findMany({
    where: { propertyId },
    orderBy: { order: 'asc' },
    include: spaceInclude
  });
}

export async function createSpace(tenantId: string, propertyId: string, input: SpaceInput) {
  await assertTenantProperty(tenantId, propertyId);

  const orderAggregate = await prisma.space.aggregate({
    where: { propertyId },
    _max: { order: true }
  });

  return prisma.space.create({
    data: {
      propertyId,
      name: input.name,
      order: input.order ?? ((orderAggregate._max.order ?? 0) + 1),
      status: normalizeSpaceStatus(input.status),
      dimensions: input.dimensions == null ? null : JSON.stringify(input.dimensions),
      assets: {
        create: buildAssetsCreate(input.assets)
      }
    } as any,
    include: spaceInclude
  });
}

export async function updateSpace(tenantId: string, propertyId: string, spaceId: string, input: Partial<SpaceInput>) {
  await assertTenantSpace(tenantId, propertyId, spaceId);

  return prisma.$transaction(async (transaction: any) => {
    const shouldReplaceAssets = input.assets !== undefined;

    if (shouldReplaceAssets) {
      await transaction.asset.deleteMany({ where: { spaceId } });
    }

    const data: any = {};

    if (input.name !== undefined) data.name = input.name;
    if (input.order !== undefined) data.order = input.order;
    if (input.status !== undefined) data.status = normalizeSpaceStatus(input.status);
    if (input.dimensions !== undefined) data.dimensions = input.dimensions == null ? null : JSON.stringify(input.dimensions);

    if (shouldReplaceAssets) {
      data.assets = {
        create: buildAssetsCreate(input.assets)
      };
    }

    return transaction.space.update({
      where: { id: spaceId },
      data,
      include: spaceInclude
    });
  });
}

export async function deleteSpace(tenantId: string, propertyId: string, spaceId: string) {
  await assertTenantSpace(tenantId, propertyId, spaceId);

  await prisma.space.delete({
    where: { id: spaceId }
  });

  return { id: spaceId };
}

// DEFAULT PROPERTY SPACES START
function buildDefaultSpaces(input: PropertyInput): SpaceInput[] {
  return [
    {
      name: 'Vista general',
      order: 1,
      dimensions: null,
      assets: [
        {
          type: AssetType.PANORAMA_360,
          url: input.panoramaUrl && input.panoramaUrl.trim().length > 0 ? input.panoramaUrl : 'demo://panorama/general',
          thumbnail: input.coverImage ?? '',
          format: AssetFormat.JPG,
          size: 80,
          hotspots: [
            {
              label: 'Vista general',
              type: HotspotType.INFO,
              position: { x: 52, y: 48 },
              body: 'Hotspot inicial creado automáticamente para evitar propiedades sin experiencia inmersiva.',
              metric: input.area ? `${input.area} m2 aprox.` : 'Medidas pendientes'
            },
            {
              label: 'Contactar agente',
              type: HotspotType.CTA,
              position: { x: 70, y: 62 },
              body: 'CTA comercial inicial preparado para lead o reserva de visita.',
              metric: 'Lead'
            }
          ]
        }
      ]
    }
  ];
}
// DEFAULT PROPERTY SPACES END
export async function createProperty(tenantId: string, input: PropertyInput) {
  return prisma.property.create({
    data: {
      tenantId,
      title: input.title,
      description: input.description ?? '',
      type: input.type ?? PropertyType.APARTMENT,
      status: input.status ?? PropertyStatus.DRAFT,
      price: input.price ?? 0,
      area: input.area ?? 0,
      rooms: input.rooms ?? 0,
      bathrooms: input.bathrooms ?? 0,
      coverImage: input.coverImage ?? '',
      address: input.address ?? '',
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      spaces: {
        create: buildSpacesCreate(input.spaces && input.spaces.length > 0 ? input.spaces : buildDefaultSpaces(input))
      }
    },
    include: propertyInclude
  });
}

export async function updateProperty(tenantId: string, propertyId: string, input: PropertyInput) {
  const existingProperty = await prisma.property.findFirst({
    where: { id: propertyId, tenantId }
  });

  if (!existingProperty) {
    throw new AppError(404, 'Propiedad no encontrada.');
  }

  return prisma.$transaction(async (transaction: any) => {
    const shouldReplaceSpaces = Array.isArray(input.spaces);

    if (shouldReplaceSpaces) {
      await transaction.space.deleteMany({ where: { propertyId } });
    }

    return transaction.property.update({
      where: { id: propertyId },
      data: {
        title: input.title,
        description: input.description ?? '',
        type: input.type ?? PropertyType.APARTMENT,
        status: input.status ?? PropertyStatus.DRAFT,
        price: input.price ?? 0,
        area: input.area ?? 0,
        rooms: input.rooms ?? 0,
        bathrooms: input.bathrooms ?? 0,
        coverImage: input.coverImage ?? '',
        address: input.address ?? '',
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        spaces: shouldReplaceSpaces
          ? {
              create: buildSpacesCreate(input.spaces && input.spaces.length > 0 ? input.spaces : buildDefaultSpaces(input))
            }
          : undefined
      },
      include: propertyInclude
    });
  });
}

export async function deleteProperty(tenantId: string, propertyId: string) {
  const existingProperty = await prisma.property.findFirst({
    where: { id: propertyId, tenantId }
  });

  if (!existingProperty) {
    throw new AppError(404, 'Propiedad no encontrada.');
  }

  await prisma.property.delete({ where: { id: propertyId } });

  return { id: propertyId };
}





function buildHotspotsCreate(hotspots: HotspotInput[] | undefined) {
  return (hotspots ?? []).map((hotspot) => ({
    label: hotspot.label,
    type: hotspot.type,
    position: JSON.stringify(hotspot.position ?? { x: 50, y: 50 }),
    body: hotspot.body ?? '',
    metric: hotspot.metric ?? ''
  }));
}

async function assertTenantAsset(tenantId: string, propertyId: string, spaceId: string, assetId: string) {
  await assertTenantSpace(tenantId, propertyId, spaceId);

  const asset = await prisma.asset.findFirst({
    where: {
      id: assetId,
      spaceId
    },
    include: {
      hotspots: true
    }
  });

  if (!asset) {
    throw new Error('Asset no encontrado.');
  }

  return asset;
}

export async function listAssets(tenantId: string, propertyId: string, spaceId: string) {
  await assertTenantSpace(tenantId, propertyId, spaceId);

  return prisma.asset.findMany({
    where: { spaceId },
    include: {
      hotspots: true
    },
    orderBy: {
      createdAt: 'asc'
    }
  });
}

export async function createAsset(tenantId: string, propertyId: string, spaceId: string, input: AssetInput) {
  await assertTenantSpace(tenantId, propertyId, spaceId);

  return prisma.asset.create({
    data: {
      spaceId,
      type: input.type,
      url: input.url,
      thumbnail: input.thumbnail ?? '',
      format: input.format,
      size: input.size ?? 0,
      hotspots: {
        create: buildHotspotsCreate(input.hotspots)
      }
    },
    include: {
      hotspots: true
    }
  });
}

export async function updateAsset(
  tenantId: string,
  propertyId: string,
  spaceId: string,
  assetId: string,
  input: Partial<AssetInput>
) {
  await assertTenantAsset(tenantId, propertyId, spaceId, assetId);

  return prisma.$transaction(async (transaction) => {
    const data: any = {};

    if (input.type !== undefined) data.type = input.type;
    if (input.url !== undefined) data.url = input.url;
    if (input.thumbnail !== undefined) data.thumbnail = input.thumbnail ?? '';
    if (input.format !== undefined) data.format = input.format;
    if (input.size !== undefined) data.size = input.size ?? 0;

    if (input.hotspots !== undefined) {
      await transaction.hotspot.deleteMany({ where: { assetId } });
      data.hotspots = {
        create: buildHotspotsCreate(input.hotspots)
      };
    }

    return transaction.asset.update({
      where: { id: assetId },
      data,
      include: {
        hotspots: true
      }
    });
  });
}

export async function deleteAsset(tenantId: string, propertyId: string, spaceId: string, assetId: string) {
  await assertTenantAsset(tenantId, propertyId, spaceId, assetId);

  await prisma.asset.delete({
    where: { id: assetId }
  });

  return {
    id: assetId,
    deleted: true
  };
}
