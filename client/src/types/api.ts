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

export interface CaptureInputAsset {
  id: string;
  captureJobId: string;
  type: string;
  filename: string;
  url: string;
  publicId: string;
  source: string;
  format: string;
  size: number;
  status: string;
  rightsStatus: string;
  qualityScore: number | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface CaptureOutputAsset {
  id: string;
  captureJobId: string;
  type: string;
  format: string;
  url: string;
  publicId: string;
  status: string;
  viewerReady: boolean;
  mobileReady: boolean;
  publishedUrl: string;
  qrUrl: string;
  analyticsEnabled: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface CaptureJob {
  id: string;
  tenantId: string;
  userId: string;
  leadId: string | null;
  propertyId: string | null;
  title: string;
  clientName: string;
  projectType: string;
  vertical: string;
  status: string;
  priority: string;
  source: string;
  assignedTo: string;
  dueDate: string | null;
  estimatedCost: number | null;
  estimatedHours: number | null;
  commercialValue: number | null;
  riskLevel: string;
  nextAction: string;
  notes: string;
  publicUrl: string;
  qrUrl: string;
  createdAt: string;
  updatedAt: string;
  property?: { id: string; title: string } | null;
  lead?: { id: string; email: string; phone?: string; status: string } | null;
  inputAssets?: CaptureInputAsset[];
  outputAssets?: CaptureOutputAsset[];
  _count?: {
    inputAssets: number;
    outputAssets: number;
  };
}

export interface PublicCaptureJob {
  id: string;
  title: string;
  clientName: string;
  projectType: string;
  vertical: string;
  status: string;
  publicUrl: string;
  qrUrl: string;
  outputAssets: Array<{
    id: string;
    type: string;
    format: string;
    url: string;
    viewerReady: boolean;
    mobileReady: boolean;
  }>;
}
