import type { Space } from '@/types/viewer';

export interface CompareData {
  id: string;
  title: string;
  description: string;
  price: number;
  area: number;
  rooms: number;
  bathrooms: number;
  address: string;
  thumbnailUrl: string;
  isPasswordProtected?: boolean;
  spaces: Space[];
  views?: number;
}
