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
  /** Optional URL to an ambient audio MP3 for this space (e.g. '/audio/lounge.mp3'). */
  ambientAudio?: string;
  /** Editorial subheadline shown in the storytelling overlay when entering this space. */
  storySubheadline?: string;
  /** Editorial microcaption shown below the accent line in the storytelling overlay. */
  storyHighlight?: string;
  /** Contextual CTA label for this space (e.g. 'Solicitar visita', 'Hablar con asesor'). */
  ctaLabel?: string;
  /** Optional subtext shown below the contextual CTA action. */
  ctaSubtext?: string;
  /** Position of this space's pin on the property floorplan, as percentage coords (0-100). */
  floorplanPin?: { x: number; y: number };
  /** Seconds this space is shown during the cinematic auto-advance tour. Default: 10. */
  guidedDuration?: number;
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
  /** Optional URL to a floorplan image (PNG/JPG). Enables the interactive floorplan view. */
  floorplanUrl?: string;
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

/** Minimal preview data passed to PanoramaViewer for hotspot hover cards */
export interface SpacePreview {
  name: string;
  thumbnail: string | null;
  assetType: ViewerAssetType;
}

export interface RendererLifecycle {
  load: (assetUrl?: string) => Promise<void>;
  resize: () => void;
  dispose: () => void;
}
