export interface SubscriptionResponse {
  tenantId: string;
  plan: string;
  subscription: {
    id: string;
    stripeCustomerId: string;
    stripeSubscriptionId: string;
    plan: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  } | null;
}

export interface TenantUsageResponse {
  plan: string;
  propertiesUsed: number;
  propertyLimit: number | null;
  remaining: number | null;
  canCreateMore: boolean;
}

export interface StorageUsageResponse {
  plan: string;
  usedMb: number;
  limitMb: number | null;
  remainingMb: number | null;
  percentageUsed: number;
  isUnlimited: boolean;
}

export interface LeadRecord {
  id: string;
  email: string;
  phone: string;
  notes: string;
  source: string;
  createdAt: string;
}

export interface UploadAssetResponse {
  provider: string;
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

export interface DashLead {
  id: string;
  propertyId: string;
  propertyTitle: string;
  email: string;
  status: string;
  nextActionAt: string | null;
  createdAt: string;
}
