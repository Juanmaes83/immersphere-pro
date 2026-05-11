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

function normalizeSpaces(spaces: ApiSpace[]): Space[] {
  return spaces.map((space) => ({
    id: space.id,
    name: space.name,
    order: space.order,
    dimensions: space.dimensions ?? { width: null, height: null, depth: null },
    assets: space.assets.map((asset) => ({
      id: asset.id,
      type: normalizeAssetType(asset.type),
      url: asset.url,
      thumbnail: asset.thumbnail,
      format: normalizeAssetFormat(asset.format),
      size: asset.size,
      hotspots: asset.hotspots.map((hotspot) => ({
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

function normalizeProperty(property: ApiProperty): ImmersiveProperty {
  return {
    id: property.id,
    tenantId: property.tenantId,
    title: property.title,
    location: 'Ubicación pendiente',
    type: property.type,
    status: property.status,
    price: property.price,
    area: property.area,
    rooms: property.rooms,
    bathrooms: property.bathrooms,
    description: property.description,
    coverImage: property.coverImage,
    leadScore: Math.min(95, 50 + (property.leadsCount ?? 0) * 3),
    visits: 0,
    leads: property.leadsCount ?? 0,
    spaces: normalizeSpaces(property.spaces ?? [])
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

      set({
        properties: response.items.map(normalizeProperty),
        pagination: response.pagination,
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
