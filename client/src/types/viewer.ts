export type ViewerAssetType = 'panorama_360' | 'gaussian_splat' | 'mesh';

export type ViewerAssetFormat =
  | 'jpg'
  | 'jpeg'
  | 'png'
  | 'webp'
  | 'splat'
  | 'ply'
  | 'sog'
  | 'glb'
  | 'meta.json'
  | 'lod-meta.json';

export type HotspotType = 'info' | 'cta' | 'navigation' | 'measurement';

export type ViewerEventType =
  | 'viewer_ready'
  | 'viewer_error'
  | 'space_change'
  | 'hotspot_click'
  | 'drag'
  | 'zoom'
  | 'reset'
  | 'cta_lead'
  | 'asset_upload'
  | 'splat_ready'
  | 'splat_error'
  | 'splat_editor_remove'
  | 'splat_editor_clip'
  | 'viewer_whatsapp_click'
  | 'tour_start'
  | 'tour_step'
  | 'tour_complete';

export interface SpaceDimensions {
  width: number | null;
  height: number | null;
  depth: number | null;
}

export interface HotspotPosition {
  x: number;
  y: number;
  z?: number;
}

export interface Hotspot {
  id: string;
  label: string;
  type: HotspotType;
  position: HotspotPosition;
  body?: string;
  metric?: string;
  targetSpaceId?: string;
  data?: Record<string, unknown>;
}

export interface ViewerAsset {
  id: string;
  type: ViewerAssetType;
  url: string;
  thumbnail: string;
  format: ViewerAssetFormat;
  size: number;
  hotspots: Hotspot[];
}

export type SpaceStatus = 'ACTIVE' | 'HIDDEN';

export interface Space {
  id: string;
  name: string;
  order: number;
  status: SpaceStatus;
  dimensions: SpaceDimensions;
  assets: ViewerAsset[];
}

export interface ViewerEvent {
  id: string;
  type: ViewerEventType;
  timestamp: number;
  spaceId?: string;
  assetId?: string;
  hotspotId?: string;
  data?: Record<string, unknown>;
}

export interface ViewerProps {
  spaces: Space[];
  activeSpaceId: string;
  onSpaceChange: (spaceId: string) => void;
  onHotspotClick: (hotspot: Hotspot) => void;
  onAnalyticsEvent: (event: ViewerEvent) => void;
}

export interface UniversalViewerProps {
  propertyId: string;
  spaces: Space[];
  initialSpaceId?: string;
  primaryColor?: string;
  removeBranding?: boolean;
  className?: string;
  /** Shown in the branded loading screen (seconds 0-2). Falls back to first space name. */
  propertyTitle?: string;
  /** Optional agency / studio name shown below the property title during load. */
  agencyName?: string;
  onAnalyticsEvent: (event: ViewerEvent) => void;
}


export interface GaussianSplatViewState {
  position: {
    x: number;
    y: number;
    z: number;
  };
  yaw: number;
  pitch: number;
}

export interface GaussianSplatRendererConfig {
  container: HTMLDivElement;
  assetUrl: string;
  initialPosition?: {
    x: number;
    y: number;
    z: number;
  };
  initialYaw?: number;
  initialPitch?: number;
  onReady?: () => void;
  onError?: (error: Error) => void;
  onViewChange?: (state: GaussianSplatViewState) => void;
}

export interface RemovedSplatZone {
  id: string;
  x: number;
  y: number;
  radius: number;
  createdAt: number;
}

export interface PanoramaViewState {
  yaw: number;
  pitch: number;
  fov: number;
}

export interface PanoramaEngineConfig {
  container: HTMLDivElement;
  imageUrl: string;
  initialYaw?: number;
  initialPitch?: number;
  initialFov?: number;
  minFov?: number;
  maxFov?: number;
  onReady?: () => void;
  onError?: (error: Error) => void;
  onViewChange?: (state: PanoramaViewState) => void;
}

export interface RendererLifecycle {
  load: (assetUrl?: string) => Promise<void>;
  resize: () => void;
  dispose: () => void;
}
