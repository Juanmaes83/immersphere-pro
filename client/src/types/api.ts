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

export interface CaptureCommercialBrief {
  propertyType: string;
  location: string;
  surface: string;
  rooms: string;
  bathrooms: string;
  priceRange: string;
  targetAudience: string;
  salesObjective: string;
  keyBenefits: string[];
  differentiators: string[];
  tone: 'professional' | 'premium' | 'direct' | 'inspirational' | 'technical';
  ctaGoal: 'contact' | 'book_visit' | 'request_info' | 'download' | 'call';
  brandNotes: string;
  constraints: string;
}

export interface CaptureAppliedAiContent {
  sourceRunId?: string;
  commercialTitle: string;
  shortDescription: string;
  longDescription: string;
  salesAngle: string;
  targetAudience: string;
  ctaPrimary: string;
  ctaSecondary: string;
  benefits: string[];
  videoHook: string;
  videoScriptSummary: string;
  nextActions?: Array<{
    action: string;
    priority: 'low' | 'medium' | 'high';
    reason: string;
    status: 'draft' | 'accepted' | 'done';
  }>;
  qaSummary?: string;
}

export interface CaptureHotspot {
  id: string;
  captureJobId: string;
  tenantId: string;
  sourceRunId: string | null;
  label: string;
  description: string;
  roomOrZone: string;
  hotspotType: 'info' | 'cta' | 'navigation' | 'feature' | 'warning';
  priority: 'low' | 'medium' | 'high';
  cta: string;
  mediaSuggestion: string;
  businessObjective: string;
  position: Record<string, unknown> | null;
  status: 'draft' | 'approved' | 'published' | 'archived';
  isPublic: boolean;
  sortOrder: number;
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
  commercialBrief: CaptureCommercialBrief | null;
  commercialBriefUpdatedAt: string | null;
  commercialBriefCompleteness: number | null;
  appliedAiContent: CaptureAppliedAiContent | null;
  appliedAiContentUpdatedAt: string | null;
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
  hotspots?: CaptureHotspot[];
  _count?: {
    inputAssets: number;
    outputAssets: number;
  };
}

export interface CaptureAiProcessingResult {
  experienceStructure: {
    recommendedTitle: string;
    intro: string;
    sections: Array<{
      title: string;
      objective: string;
      recommendedMedia: string;
      notes: string;
    }>;
    recommendedFlow: string[];
  };
  suggestedHotspots: Array<{
    label: string;
    description: string;
    roomOrZone: string;
    hotspotType: 'info' | 'cta' | 'navigation' | 'feature' | 'warning';
    priority: 'low' | 'medium' | 'high';
    businessObjective: string;
    cta: string;
    mediaSuggestion: string;
    assetDependency: string;
    whyItMatters: string;
  }>;
  commercialCopy: {
    shortDescription: string;
    longDescription: string;
    propertyHighlights: string[];
    salesAngle: string;
    targetAudience: string;
    ctaSuggestions: string[];
  };
  videoScript: {
    hook: string;
    sceneList: Array<{
      scene: string;
      visual: string;
      voiceover: string;
      duration: string;
    }>;
    voiceover: string;
    closingCTA: string;
    formatRecommendations: {
      horizontal: string;
      vertical: string;
    };
  };
  missingMaterial: Array<{
    item: string;
    severity: 'low' | 'medium' | 'high';
    reason: string;
    recommendation: string;
  }>;
  qaRecommendations: {
    desktop: string[];
    mobile: string[];
    performance: string[];
    viewer: string[];
    fallback: string[];
    publicationReadiness: 'not_ready' | 'needs_review' | 'ready';
  };
  nextActions: Array<{
    action: string;
    ownerSuggestion: string;
    priority: 'low' | 'medium' | 'high';
    reason: string;
  }>;
  confidence: {
    score: number;
    explanation: string;
  };
}

export interface CaptureAiProcessingRun {
  id: string;
  captureJobId: string;
  tenantId: string;
  userId: string | null;
  status: 'running' | 'completed' | 'failed';
  promptVersion: string;
  inputSummary: unknown;
  result: CaptureAiProcessingResult | null;
  error: string | null;
  model: string | null;
  tokensInput: number | null;
  tokensOutput: number | null;
  createdAt: string;
  updatedAt: string;
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
  appliedAiContent: Omit<CaptureAppliedAiContent, 'sourceRunId' | 'nextActions' | 'qaSummary'> | null;
  hotspots: Array<{
    id: string;
    label: string;
    description: string;
    roomOrZone: string;
    hotspotType: 'info' | 'cta' | 'navigation' | 'feature' | 'warning';
    priority: 'low' | 'medium' | 'high';
    cta: string;
    mediaSuggestion: string;
    position: Record<string, unknown> | null;
    sortOrder: number;
  }>;
  outputAssets: Array<{
    id: string;
    type: string;
    format: string;
    url: string;
    viewerReady: boolean;
    mobileReady: boolean;
    isPremium3d?: boolean;
    embeddable?: boolean;
  }>;
}
