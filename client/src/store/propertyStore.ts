import { create } from 'zustand';
import { api, getApiErrorMessage, unwrapApiResponse } from '@/services/api';
import type { Hotspot, Space, ViewerAsset } from '@/types/viewer';

interface ApiHotspot {
  id: string;
  label: string;
  type: string;
  position: { x: number; y: number; z?: number };
  body?: string;
  metric?: string;
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
  dimensions: { width: number | null; height: number | null; depth: number | null } | null;
  assets: ApiAsset[];
}

interface ApiProperty {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  type: string;
  status: string;
  price: number;
  area: number;
  rooms: number;
  bathrooms: number;
  coverImage: string;
  spaces: ApiSpace[];
  leadsCount?: number;
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
  location: string;
  type: string;
  status: string;
  price: number;
  area: number;
  rooms: number;
  bathrooms: number;
  description: string;
  coverImage: string;
  panoramaUrl: string;
  leadScore: number;
  visits: number;
  leads: number;
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
  price?: number;
  area?: number;
  rooms?: number;
  bathrooms?: number;
  coverImage?: string;
  panoramaUrl?: string;
}

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
  clearSelectedProperty: () => void;
  clearError: () => void;
}

function normalizeAssetType(type: string): ViewerAsset['type'] {
  const normalized = type.toUpperCase();

  if (normalized === 'GAUSSIAN_SPLAT') return 'gaussian_splat';
  if (normalized === 'MESH') return 'mesh';

  return 'panorama_360';
}

function normalizeAssetFormat(format: string): ViewerAsset['format'] {
  const normalized = format.toLowerCase();
  const allowed: ViewerAsset['format'][] = ['jpg', 'jpeg', 'png', 'webp', 'splat', 'ply', 'glb'];

  return allowed.includes(normalized as ViewerAsset['format']) ? (normalized as ViewerAsset['format']) : 'jpg';
}

function normalizeHotspotType(type: string): Hotspot['type'] {
  const normalized = type.toUpperCase();

  if (normalized === 'CTA') return 'cta';
  if (normalized === 'NAVIGATION') return 'navigation';
  if (normalized === 'MEASUREMENT') return 'measurement';

  return 'info';
}

function normalizeSpaces(spaces: ApiSpace[] = []): Space[] {
  return (Array.isArray(spaces) ? spaces : []).map((space) => ({
    id: space.id,
    name: space.name,
    order: space.order,
    dimensions: space.dimensions ?? { width: null, height: null, depth: null },
    assets: (Array.isArray(space.assets) ? space.assets : []).map((asset) => ({
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
        position: hotspot.position,
        body: hotspot.body,
        metric: hotspot.metric
      }))
    }))
  }));
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
      <text x="1024" y="540" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="#a5f3fc">Panorama 360 demo seguro</text>
      <text x="1024" y="600" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#cbd5e1">Sustituir por imagen equirectangular real en Fase 5</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function normalizeSpacesWithFallbacks(spaces: ApiSpace[] = [], property: ApiProperty): Space[] {
  const normalizedSpaces = normalizeSpaces(spaces);
  const coverImage = (property.coverImage ?? '').trim();
  const demoPanorama = createDemoPanoramaUrl(property.title);

  return normalizedSpaces.map((space) => ({
    ...space,
    assets: space.assets.map((asset) => {
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
  }));
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
  return {
    id: property.id,
    tenantId: property.tenantId,
    title: property.title,
    location: 'Ubicacion pendiente',
    type: property.type,
    status: property.status,
    price: property.price,
    area: property.area,
    rooms: property.rooms,
    bathrooms: property.bathrooms,
    description: property.description,
    coverImage: property.coverImage,
    panoramaUrl: getPrimaryPanoramaUrl(property.spaces ?? []),
    leadScore: Math.min(95, 50 + (property.leadsCount ?? 0) * 3),
    visits: 0,
    leads: property.leadsCount ?? 0,
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

  clearSelectedProperty: () => {
    set({ selectedProperty: null });
  },

  clearError: () => {
    set({ error: null });
  }
}));

