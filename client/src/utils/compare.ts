import type { CompareData } from '@/types/compare';
import type { Space } from '@/types/viewer';

export function getCompareThumbnail(raw: Record<string, unknown>): string {
  const cover = raw.coverImage as string | undefined;
  if (cover && !cover.startsWith('data:') && !cover.startsWith('demo://')) return cover;
  const spaces = (raw.spaces as Array<{ assets: Array<{ thumbnail?: string; url?: string }> }> | undefined) ?? [];
  for (const space of spaces) {
    for (const asset of space.assets ?? []) {
      for (const u of [asset.thumbnail, asset.url]) {
        if (u && !u.startsWith('data:') && !u.startsWith('demo://')) return u;
      }
    }
  }
  return '';
}

export function toCompareData(raw: Record<string, unknown>): CompareData {
  if (raw.isPasswordProtected) {
    return {
      id: String(raw.id ?? ''),
      title: String(raw.title ?? 'Propiedad protegida'),
      description: '',
      price: 0,
      area: 0,
      rooms: 0,
      bathrooms: 0,
      address: '',
      thumbnailUrl: '',
      isPasswordProtected: true,
      spaces: []
    };
  }
  return {
    id: String(raw.id ?? ''),
    title: String(raw.title ?? ''),
    description: String(raw.description ?? ''),
    price: Number(raw.price ?? 0),
    area: Number(raw.area ?? 0),
    rooms: Number(raw.rooms ?? 0),
    bathrooms: Number(raw.bathrooms ?? 0),
    address: String(raw.address ?? ''),
    thumbnailUrl: getCompareThumbnail(raw),
    isPasswordProtected: false,
    spaces: (raw.spaces ?? []) as Space[],
    views: raw.views !== undefined ? Number(raw.views) : undefined
  };
}
