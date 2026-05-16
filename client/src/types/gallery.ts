export interface PropertyStatItem {
  id: string;
  title: string;
  coverImage: string;
  type: string;
  price: number;
  area: number;
  rooms: number;
  views: number;
}

export interface PublicProperty {
  id: string;
  title: string;
  description: string;
  type: string;
  price: number;
  area: number;
  rooms: number;
  bathrooms: number;
  coverImage: string;
  address: string;
}

export interface PublicTenantProfile {
  name: string;
  slug: string;
  logoText: string;
  logoUrl: string;
  primaryColor: string;
  properties: PublicProperty[];
}
