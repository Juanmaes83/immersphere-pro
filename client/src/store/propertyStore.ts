import { create } from 'zustand';
import { api, getApiErrorMessage, unwrapApiResponse } from '@/services/api';
import type { Hotspot, Space, ViewerAsset } from '@/types/viewer';

interface ApiHotspot {
  id: string;
  label: string;
  type: string;
  // Prisma stores position as JSON.stringify'd string; the normalizer parses it back.
  position: { x: number; y: number; z?: number } | string;
  body?: string;
  metric?: string;
  targetSpaceId?: string;
}

interface ApiAsset {
  id: string;
  type: string;
  url: string;
  thumbnail: string;
  format: string;
  size: number;
  hotspots: ApiHotspot[];
}

interface ApiSpace {
  id: string;
  name: string;
  order: number;
  status: string;
  // Prisma stores dimensions as JSON.stringify'd string; the normalizer parses it back.
  dimensions: { width: number | null; height: number | null; depth: number | null } | string | null;
  assets: ApiAsset[];
  // W2 storytelling / CTA / floorplan fields (Prisma returns these directly)
  storySubheadline?: string;
  storyHighlight?: string;
  ctaLabel?: string;
  ctaSubtext?: string;
  floorplanPin?: { x: number; y: number } | null;
  // W3 audio + per-space timing
  ambientAudio?: string;
  guidedDuration?: number;
}

interface ApiProperty {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  type: string;
  status: string;
  language?: string;
  price: number;
  area: number;
  rooms: number;
  bathrooms: number;
  coverImage: string;
  floorplanUrl: string;
  heroVideoUrl?: string;
  heroVideoPoster?: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  isPasswordProtected?: boolean;
  spaces: ApiSpace[];
  _count?: { leads: number };
  tenant?: { phone?: string; whatsappNumber?: string; calendlyUrl?: string; removeBranding?: boolean; primaryColor?: string; name?: string; logoUrl?: string; logoText?: string; plan?: string; subscription?: { status: string; updatedAt: string } };
  createdAt: string;
  updatedAt: string;
}

interface PropertiesResponse {
  items: ApiProperty[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface ImmersiveProperty {
  id: string;
  tenantId: string;
  title: string;
  type: string;
  status: string;
  language: string;
  price: number;
  area: number;
  rooms: number;
  bathrooms: number;
  description: string;
  coverImage: string;
  panoramaUrl: string;
  floorplanUrl: string;
  heroVideoUrl: string;
  heroVideoPoster: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  isPasswordProtected?: boolean;
  thumbnailUrl: string;
  leads: number;
  tenantPhone: string;
  tenantWhatsapp: string;
  tenantCalendlyUrl: string;
  tenantPrimaryColor: string;
  tenantName: string;
  tenantLogoUrl: string;
  tenantLogoText: string;
  removeBranding: boolean;
  /** Tenant plan slug: 'STARTER' | 'PROFESSIONAL' | 'AGENCY' | 'ENTERPRISE' */
  tenantPlan: string;
  /** Subscription status: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED' */
  tenantSubscriptionStatus: string;
  /** ISO date string of last subscription update (used for grace period calculation) */
  tenantSubscriptionUpdatedAt: string;
  spaces: Space[];
}

export interface PropertyFilters {
  query?: string;
  type?: string;
  status?: string;
  maxPrice?: number;
  minPrice?: number;
  minArea?: number;
  maxArea?: number;
  page?: number;
  limit?: number;
}

export interface CreatePropertyPayload {
  title: string;
  description?: string;
  type?: string;
  status?: string;
  language?: string;
  price?: number;
  area?: number;
  rooms?: number;
  bathrooms?: number;
  coverImage?: string;
  panoramaUrl?: string;
  floorplanUrl?: string;
  heroVideoUrl?: string;
  heroVideoPoster?: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  password?: string;
}

export interface CreateSpacePayload {
  name: string;
  order?: number;
  status?: Space['status'];
  dimensions?: Space['dimensions'] | null;
}

export type UpdateSpacePayload = Partial<CreateSpacePayload>;

export interface CreateAssetPayload {
  type: ViewerAsset['type'];
  url: string;
  thumbnail?: string;
  format: ViewerAsset['format'];
  size?: number;
  hotspots?: Hotspot[];
}

export type UpdateAssetPayload = Partial<CreateAssetPayload>;

interface PropertyState {
  properties: ImmersiveProperty[];
  selectedProperty: ImmersiveProperty | null;
  isLoading: boolean;
  error: string | null;
  pagination: PropertiesResponse['pagination'] | null;
  fetchProperties: (filters?: PropertyFilters) => Promise<void>;
  fetchPropertyById: (propertyId: string) => Promise<ImmersiveProperty | null>;
  createProperty: (payload: CreatePropertyPayload) => Promise<ImmersiveProperty>;
  updateProperty: (propertyId: string, payload: Partial<CreatePropertyPayload>) => Promise<ImmersiveProperty>;
  deleteProperty: (propertyId: string) => Promise<void>;
  createSpace: (propertyId: string, payload: CreateSpacePayload) => Promise<Space>;
  updateSpace: (propertyId: string, spaceId: string, payload: UpdateSpacePayload) => Promise<Space>;
  deleteSpace: (propertyId: string, spaceId: string) => Promise<void>;
  createAsset: (propertyId: string, spaceId: string, payload: CreateAssetPayload) => Promise<ViewerAsset>;
  updateAsset: (propertyId: string, spaceId: string, assetId: string, payload: UpdateAssetPayload) => Promise<ViewerAsset>;
  deleteAsset: (propertyId: string, spaceId: string, assetId: string) => Promise<void>;
  unlockProperty: (propertyId: string, password: string) => Promise<ImmersiveProperty | null>;
  clearSelectedProperty: () => void;
  clearError: () => void;
}

function normalizeAssetType(type: string): ViewerAsset['type'] {
  const normalized = type.toUpperCase();

  if (normalized === 'GAUSSIAN_SPLAT') return 'gaussian_splat';
  if (normalized === 'MESH') return 'mesh';
  if (normalized === 'LUMA_EMBED') return 'luma_embed';

  return 'panorama_360';
}

function normalizeAssetFormat(format: string): ViewerAsset['format'] {
  const normalized = format.toLowerCase();
  const allowed: ViewerAsset['format'][] = ['jpg', 'jpeg', 'png', 'webp', 'splat', 'ply', 'glb', 'iframe'];

  return allowed.includes(normalized as ViewerAsset['format']) ? (normalized as ViewerAsset['format']) : 'jpg';
}

function normalizeHotspotType(type: string): Hotspot['type'] {
  const normalized = type.toUpperCase();

  if (normalized === 'CTA') return 'cta';
  if (normalized === 'NAVIGATION') return 'navigation';
  if (normalized === 'MEASUREMENT') return 'measurement';
  if (normalized === 'PRICE') return 'price';

  return 'info';
}

function normalizeAsset(asset: ApiAsset): ViewerAsset {
  return {
    id: asset.id,
    type: normalizeAssetType(asset.type),
    url: asset.url,
    thumbnail: asset.thumbnail,
    format: normalizeAssetFormat(asset.format),
    size: asset.size,
    hotspots: (Array.isArray(asset.hotspots) ? asset.hotspots : []).map((hotspot) => ({
      id: hotspot.id,
      label: hotspot.label,
      type: normalizeHotspotType(hotspot.type),
      position: (() => {
        if (typeof hotspot.position === 'string') {
          try { return JSON.parse(hotspot.position) as { x: number; y: number; z?: number }; } catch { return { x: 50, y: 50 }; }
        }
        return (hotspot.position as { x: number; y: number; z?: number }) ?? { x: 50, y: 50 };
      })(),
      body: hotspot.body,
      metric: hotspot.metric,
      ...(hotspot.targetSpaceId ? { targetSpaceId: hotspot.targetSpaceId } : {})
    }))
  };
}

function isFallbackAsset(asset: ViewerAsset): boolean {
  return asset.id.endsWith('-fallback-panorama');
}

function toApiAssetType(type: ViewerAsset['type']): string {
  if (type === 'gaussian_splat') return 'GAUSSIAN_SPLAT';
  if (type === 'mesh') return 'MESH';
  if (type === 'luma_embed') return 'LUMA_EMBED';

  return 'PANORAMA_360';
}

function toApiAssetFormat(format: ViewerAsset['format']): string {
  return String(format).toUpperCase();
}

function toApiHotspotType(type: Hotspot['type']): string {
  if (type === 'cta') return 'CTA';
  if (type === 'navigation') return 'NAVIGATION';
  if (type === 'measurement') return 'MEASUREMENT';
  if (type === 'price') return 'PRICE';

  return 'INFO';
}

function buildAssetApiPayload(payload: CreateAssetPayload | UpdateAssetPayload): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (payload.type !== undefined) result.type = toApiAssetType(payload.type);
  if (payload.url !== undefined) result.url = payload.url;
  if (payload.thumbnail !== undefined) result.thumbnail = payload.thumbnail;
  if (payload.format !== undefined) result.format = toApiAssetFormat(payload.format);
  if (payload.size !== undefined) result.size = payload.size;

  if (payload.hotspots !== undefined) {
    result.hotspots = payload.hotspots.map((hotspot) => ({
      label: hotspot.label,
      type: toApiHotspotType(hotspot.type),
      position: hotspot.position,
      body: hotspot.body,
      metric: hotspot.metric,
      ...(hotspot.targetSpaceId ? { targetSpaceId: hotspot.targetSpaceId } : {})
    }));
  }

  return result;
}

function normalizeSpace(space: ApiSpace): Space {
  return {
    id: space.id,
    name: space.name,
    order: space.order,
    status: String(space.status ?? 'ACTIVE').toUpperCase() === 'HIDDEN' ? 'HIDDEN' : 'ACTIVE',
    dimensions: (() => {
      if (space.dimensions == null) return { width: null, height: null, depth: null };
      if (typeof space.dimensions === 'string') {
        try { return JSON.parse(space.dimensions) as { width: number | null; height: number | null; depth: number | null }; } catch { return { width: null, height: null, depth: null }; }
      }
      return space.dimensions as { width: number | null; height: number | null; depth: number | null };
    })(),
    assets: (Array.isArray(space.assets) ? space.assets : []).map(normalizeAsset),
    // W2 fields — backend returns strings with @default(""), coerce empty string to undefined
    ...(space.storySubheadline ? { storySubheadline: space.storySubheadline } : {}),
    ...(space.storyHighlight   ? { storyHighlight:   space.storyHighlight   } : {}),
    ...(space.ctaLabel         ? { ctaLabel:         space.ctaLabel         } : {}),
    ...(space.ctaSubtext       ? { ctaSubtext:        space.ctaSubtext       } : {}),
    ...(space.floorplanPin != null ? { floorplanPin: space.floorplanPin } : {}),
    // W3 audio + per-space timing
    ...(space.ambientAudio ? { ambientAudio: space.ambientAudio } : {}),
    guidedDuration: typeof space.guidedDuration === 'number' ? space.guidedDuration : 10,
  };
}

function normalizeSpaces(spaces: ApiSpace[] = []): Space[] {
  return (Array.isArray(spaces) ? spaces : []).map(normalizeSpace);
}


function createDemoPanoramaUrl(title: string): string {
  const safeTitle = (title || 'Immersphere Pro').replace(/[<>&"']/g, '');
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="2048" height="1024" viewBox="0 0 2048 1024">
      <defs>
        <linearGradient id="sky" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#0f172a"/>
          <stop offset="35%" stop-color="#164e63"/>
          <stop offset="70%" stop-color="#4c1d95"/>
          <stop offset="100%" stop-color="#020617"/>
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.28"/>
          <stop offset="45%" stop-color="#22d3ee" stop-opacity="0.18"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="2048" height="1024" fill="url(#sky)"/>
      <rect width="2048" height="1024" fill="url(#glow)"/>
      <path d="M0 690 C260 600 420 740 690 650 C980 555 1180 760 1480 645 C1710 560 1870 650 2048 590 L2048 1024 L0 1024 Z" fill="#020617" opacity="0.72"/>
      <path d="M0 750 C330 670 500 840 800 735 C1080 635 1300 825 1620 720 C1810 660 1940 720 2048 690 L2048 1024 L0 1024 Z" fill="#020617" opacity="0.88"/>
      <g opacity="0.35">
        <line x1="0" y1="512" x2="2048" y2="512" stroke="#ffffff" stroke-width="2"/>
        <line x1="512" y1="0" x2="512" y2="1024" stroke="#ffffff" stroke-width="1"/>
        <line x1="1024" y1="0" x2="1024" y2="1024" stroke="#ffffff" stroke-width="1"/>
        <line x1="1536" y1="0" x2="1536" y2="1024" stroke="#ffffff" stroke-width="1"/>
      </g>
      <text x="1024" y="470" text-anchor="middle" font-family="Arial, sans-serif" font-size="72" font-weight="800" fill="#ffffff">${safeTitle}</text>
      <text x="1024" y="540" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="#a5f3fc">Experiencia inmersiva 360°</text>
      <text x="1024" y="600" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#cbd5e1">Sube tu panorama 360° desde el panel de administracion</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function normalizeSpacesWithFallbacks(spaces: ApiSpace[] = [], property: ApiProperty): Space[] {
  const normalizedSpaces = normalizeSpaces(spaces);
  const coverImage = (property.coverImage ?? '').trim();
  const demoPanorama = createDemoPanoramaUrl(property.title);

  return normalizedSpaces.map((space) => {
    if (space.assets.length === 0) {
      return {
        ...space,
        assets: [
          {
            id: `${space.id}-fallback-panorama`,
            type: 'panorama_360',
            url: demoPanorama,
            thumbnail: coverImage || demoPanorama,
            format: 'jpg',
            size: 0,
            hotspots: [
              {
                id: `${space.id}-fallback-info`,
                label: 'Vista demo',
                type: 'info',
                position: { x: 50, y: 50 },
                body: 'Asset demo generado automaticamente para evitar estancias sin visor.',
                metric: 'Fallback temporal'
              }
            ]
          }
        ]
      };
    }

    // If there is at least one real panorama_360 asset (non-demo, non-empty URL),
    // filter out placeholder demo assets so selectPrimaryAsset always picks
    // the real uploaded asset instead of the auto-created demo placeholder.
    const hasRealPanorama = space.assets.some((asset) => {
      if (asset.type !== 'panorama_360') return false;
      const url = (asset.url ?? '').trim();
      return url.length > 0 && !url.startsWith('demo://');
    });

    const assetsToProcess = hasRealPanorama
      ? space.assets.filter((asset) => {
          if (asset.type !== 'panorama_360') return true;
          const url = (asset.url ?? '').trim();
          return url.length > 0 && !url.startsWith('demo://');
        })
      : space.assets;

    return {
      ...space,
      assets: assetsToProcess.map((asset) => {
        if (asset.type !== 'panorama_360') {
          return asset;
        }

        const assetUrl = (asset.url ?? '').trim();
        const needsFallback = assetUrl.length === 0 || assetUrl.startsWith('demo://');

        return {
          ...asset,
          url: needsFallback ? demoPanorama : assetUrl,
          thumbnail: asset.thumbnail || coverImage || demoPanorama
        };
      })
    };
  });
}

function getFirstRealAssetThumbnail(spaces: ApiSpace[] = []): string {
  for (const space of spaces) {
    for (const asset of space.assets ?? []) {
      const url = (asset.thumbnail || asset.url || '').trim();
      if (url && !url.startsWith('data:') && !url.startsWith('demo://')) {
        return url;
      }
    }
  }
  return '';
}

function getPrimaryPanoramaUrl(spaces: ApiSpace[] = []): string {
  for (const space of Array.isArray(spaces) ? spaces : []) {
    const assets = Array.isArray(space.assets) ? space.assets : [];

    for (const asset of assets) {
      const assetType = String(asset.type ?? '').toUpperCase();
      const assetUrl = String(asset.url ?? '').trim();

      if (assetType === 'PANORAMA_360' && assetUrl.length > 0 && !assetUrl.startsWith('demo://')) {
        return assetUrl;
      }
    }
  }

  return '';
}

function normalizeProperty(property: ApiProperty): ImmersiveProperty {
  if (property.isPasswordProtected) {
    return {
      id: property.id,
      tenantId: '',
      title: property.title,
      type: property.type ?? '',
      status: property.status ?? '',
      language: property.language ?? 'es',
      price: 0,
      area: 0,
      rooms: 0,
      bathrooms: 0,
      description: '',
      coverImage: property.coverImage ?? '',
      panoramaUrl: '',
      floorplanUrl: '',
      heroVideoUrl: '',
      heroVideoPoster: '',
      thumbnailUrl: property.coverImage ?? '',
      address: '',
      latitude: null,
      longitude: null,
      isPasswordProtected: true,
      leads: 0,
      tenantPhone: '',
      tenantWhatsapp: '',
      tenantCalendlyUrl: '',
      tenantPrimaryColor: '#7C3AED',
      tenantName: '',
      tenantLogoUrl: '',
      tenantLogoText: '',
      removeBranding: false,
      tenantPlan: 'STARTER',
      tenantSubscriptionStatus: '',
      tenantSubscriptionUpdatedAt: '',
      spaces: []
    };
  }
  const coverImage = property.coverImage ?? '';
  const assetThumb = getFirstRealAssetThumbnail(property.spaces ?? []);
  return {
    id: property.id,
    tenantId: property.tenantId,
    title: property.title,
    type: property.type,
    status: property.status,
    language: property.language ?? 'es',
    price: property.price,
    area: property.area,
    rooms: property.rooms,
    bathrooms: property.bathrooms,
    description: property.description,
    coverImage,
    panoramaUrl: getPrimaryPanoramaUrl(property.spaces ?? []),
    floorplanUrl: property.floorplanUrl ?? '',
    heroVideoUrl: property.heroVideoUrl ?? '',
    heroVideoPoster: property.heroVideoPoster ?? '',
    thumbnailUrl: coverImage || assetThumb,
    address: property.address ?? '',
    latitude: property.latitude ?? null,
    longitude: property.longitude ?? null,
    leads: property._count?.leads ?? 0,
    tenantPhone: property.tenant?.phone ?? '',
    tenantWhatsapp: property.tenant?.whatsappNumber ?? '',
    tenantCalendlyUrl: property.tenant?.calendlyUrl ?? '',
    tenantPrimaryColor: property.tenant?.primaryColor || '#7C3AED',
    tenantName: property.tenant?.name ?? '',
    tenantLogoUrl: property.tenant?.logoUrl ?? '',
    tenantLogoText: property.tenant?.logoText ?? '',
    removeBranding: property.tenant?.removeBranding ?? false,
    tenantPlan: property.tenant?.plan ?? 'STARTER',
    tenantSubscriptionStatus: property.tenant?.subscription?.status ?? '',
    tenantSubscriptionUpdatedAt: property.tenant?.subscription?.updatedAt ?? '',
    spaces: normalizeSpacesWithFallbacks(property.spaces ?? [], property)
  };
}

function buildQueryParams(filters: PropertyFilters): URLSearchParams {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (typeof value !== 'undefined' && value !== null && value !== '') {
      params.set(key, String(value));
    }
  });

  return params;
}

export const usePropertyStore = create<PropertyState>((set, get) => ({
  properties: [],
  selectedProperty: null,
  isLoading: false,
  error: null,
  pagination: null,

  fetchProperties: async (filters = {}) => {
    set({ isLoading: true, error: null });

    try {
      const params = buildQueryParams(filters);
      const response = await unwrapApiResponse<PropertiesResponse>(api.get(`/properties?${params.toString()}`));
      const apiPayload = response as any;
      const items = Array.isArray(apiPayload) ? apiPayload : apiPayload.items ?? apiPayload.data ?? [];
      const pagination = Array.isArray(apiPayload)
        ? { page: 1, limit: items.length, total: items.length, totalPages: 1 }
        : apiPayload.pagination;

      set({
        properties: items.map(normalizeProperty),
        pagination,
        isLoading: false,
        error: null
      });
    } catch (error) {
      set({ isLoading: false, error: getApiErrorMessage(error) });
    }
  },

  fetchPropertyById: async (propertyId) => {
    set({ isLoading: true, error: null });

    try {
      const response = await unwrapApiResponse<ApiProperty>(api.get(`/properties/${propertyId}`));
      const property = normalizeProperty(response);

      set({ selectedProperty: property, isLoading: false, error: null });
      return property;
    } catch (error) {
      set({ selectedProperty: null, isLoading: false, error: getApiErrorMessage(error) });
      return null;
    }
  },

  createProperty: async (payload) => {
    set({ isLoading: true, error: null });

    try {
      const response = await unwrapApiResponse<ApiProperty>(api.post('/properties', payload));
      const property = normalizeProperty(response);

      set({
        properties: [property, ...get().properties],
        selectedProperty: property,
        isLoading: false,
        error: null
      });

      return property;
    } catch (error) {
      set({ isLoading: false, error: getApiErrorMessage(error) });
      throw error;
    }
  },

  updateProperty: async (propertyId, payload) => {
    set({ isLoading: true, error: null });

    try {
      const response = await unwrapApiResponse<ApiProperty>(api.put(`/properties/${propertyId}`, payload));
      const property = normalizeProperty(response);

      set({
        properties: get().properties.map((item) => (item.id === property.id ? property : item)),
        selectedProperty: property,
        isLoading: false,
        error: null
      });

      return property;
    } catch (error) {
      set({ isLoading: false, error: getApiErrorMessage(error) });
      throw error;
    }
  },

  deleteProperty: async (propertyId) => {
    set({ isLoading: true, error: null });

    try {
      await unwrapApiResponse<{ id: string; deleted: boolean }>(api.delete(`/properties/${propertyId}`));
      set({
        properties: get().properties.filter((property) => property.id !== propertyId),
        selectedProperty: get().selectedProperty?.id === propertyId ? null : get().selectedProperty,
        isLoading: false,
        error: null
      });
    } catch (error) {
      set({ isLoading: false, error: getApiErrorMessage(error) });
      throw error;
    }
  },

  createSpace: async (propertyId, payload) => {
    set({ isLoading: true, error: null });

    try {
      const response = await unwrapApiResponse<ApiSpace>(api.post(`/properties/${propertyId}/spaces`, payload));
      const space = normalizeSpace(response);

      set({
        properties: get().properties.map((property) =>
          property.id === propertyId
            ? { ...property, spaces: [...property.spaces, space].sort((a, b) => a.order - b.order) }
            : property
        ),
        selectedProperty:
          get().selectedProperty?.id === propertyId
            ? { ...get().selectedProperty!, spaces: [...get().selectedProperty!.spaces, space].sort((a, b) => a.order - b.order) }
            : get().selectedProperty,
        isLoading: false,
        error: null
      });

      return space;
    } catch (error) {
      set({ isLoading: false, error: getApiErrorMessage(error) });
      throw error;
    }
  },

  updateSpace: async (propertyId, spaceId, payload) => {
    set({ isLoading: true, error: null });

    try {
      const response = await unwrapApiResponse<ApiSpace>(api.put(`/properties/${propertyId}/spaces/${spaceId}`, payload));
      const space = normalizeSpace(response);

      set({
        properties: get().properties.map((property) =>
          property.id === propertyId
            ? {
                ...property,
                spaces: property.spaces.map((item) => (item.id === spaceId ? space : item)).sort((a, b) => a.order - b.order)
              }
            : property
        ),
        selectedProperty:
          get().selectedProperty?.id === propertyId
            ? {
                ...get().selectedProperty!,
                spaces: get().selectedProperty!.spaces.map((item) => (item.id === spaceId ? space : item)).sort((a, b) => a.order - b.order)
              }
            : get().selectedProperty,
        isLoading: false,
        error: null
      });

      return space;
    } catch (error) {
      set({ isLoading: false, error: getApiErrorMessage(error) });
      throw error;
    }
  },

  deleteSpace: async (propertyId, spaceId) => {
    set({ isLoading: true, error: null });

    try {
      await unwrapApiResponse<{ id: string }>(api.delete(`/properties/${propertyId}/spaces/${spaceId}`));

      set({
        properties: get().properties.map((property) =>
          property.id === propertyId
            ? { ...property, spaces: property.spaces.filter((space) => space.id !== spaceId) }
            : property
        ),
        selectedProperty:
          get().selectedProperty?.id === propertyId
            ? { ...get().selectedProperty!, spaces: get().selectedProperty!.spaces.filter((space) => space.id !== spaceId) }
            : get().selectedProperty,
        isLoading: false,
        error: null
      });
    } catch (error) {
      set({ isLoading: false, error: getApiErrorMessage(error) });
      throw error;
    }
  },

  createAsset: async (propertyId, spaceId, payload) => {
    set({ isLoading: true, error: null });

    try {
      const response = await unwrapApiResponse<ApiAsset>(
        api.post(`/properties/${propertyId}/spaces/${spaceId}/assets`, buildAssetApiPayload(payload))
      );
      const asset = normalizeAsset(response);

      const appendAsset = (spaces: Space[]) =>
        spaces.map((space) =>
          space.id === spaceId
            ? { ...space, assets: [...space.assets.filter((item) => !isFallbackAsset(item)), asset] }
            : space
        );

      set({
        properties: get().properties.map((property) =>
          property.id === propertyId ? { ...property, spaces: appendAsset(property.spaces) } : property
        ),
        selectedProperty:
          get().selectedProperty?.id === propertyId
            ? { ...get().selectedProperty!, spaces: appendAsset(get().selectedProperty!.spaces) }
            : get().selectedProperty,
        isLoading: false,
        error: null
      });

      return asset;
    } catch (error) {
      set({ isLoading: false, error: getApiErrorMessage(error) });
      throw error;
    }
  },

  updateAsset: async (propertyId, spaceId, assetId, payload) => {
    set({ isLoading: true, error: null });

    try {
      const response = await unwrapApiResponse<ApiAsset>(
        api.put(`/properties/${propertyId}/spaces/${spaceId}/assets/${assetId}`, buildAssetApiPayload(payload))
      );
      const asset = normalizeAsset(response);

      const replaceAsset = (spaces: Space[]) =>
        spaces.map((space) =>
          space.id === spaceId
            ? { ...space, assets: space.assets.map((item) => (item.id === assetId ? asset : item)) }
            : space
        );

      set({
        properties: get().properties.map((property) =>
          property.id === propertyId ? { ...property, spaces: replaceAsset(property.spaces) } : property
        ),
        selectedProperty:
          get().selectedProperty?.id === propertyId
            ? { ...get().selectedProperty!, spaces: replaceAsset(get().selectedProperty!.spaces) }
            : get().selectedProperty,
        isLoading: false,
        error: null
      });

      return asset;
    } catch (error) {
      set({ isLoading: false, error: getApiErrorMessage(error) });
      throw error;
    }
  },

  deleteAsset: async (propertyId, spaceId, assetId) => {
    set({ isLoading: true, error: null });

    try {
      await unwrapApiResponse<{ id: string; deleted: boolean }>(
        api.delete(`/properties/${propertyId}/spaces/${spaceId}/assets/${assetId}`)
      );

      const removeAsset = (spaces: Space[]) =>
        spaces.map((space) =>
          space.id === spaceId
            ? { ...space, assets: space.assets.filter((asset) => asset.id !== assetId) }
            : space
        );

      set({
        properties: get().properties.map((property) =>
          property.id === propertyId ? { ...property, spaces: removeAsset(property.spaces) } : property
        ),
        selectedProperty:
          get().selectedProperty?.id === propertyId
            ? { ...get().selectedProperty!, spaces: removeAsset(get().selectedProperty!.spaces) }
            : get().selectedProperty,
        isLoading: false,
        error: null
      });
    } catch (error) {
      set({ isLoading: false, error: getApiErrorMessage(error) });
      throw error;
    }
  },

  unlockProperty: async (propertyId, password) => {
    try {
      const response = await unwrapApiResponse<ApiProperty>(
        api.post(`/properties/${propertyId}/unlock`, { password })
      );
      const property = normalizeProperty(response);
      set({ selectedProperty: property, error: null });
      return property;
    } catch {
      return null;
    }
  },

  clearSelectedProperty: () => {
    set({ selectedProperty: null });
  },

  clearError: () => {
    set({ error: null });
  }
}));
