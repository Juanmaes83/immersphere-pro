import type { ViewerAsset } from '@/types/viewer';

interface LumaEmbedViewerProps {
  asset: ViewerAsset;
}

// Normalizes Luma capture/scene URLs to the embeddable format
function toEmbedUrl(url: string): string {
  // Accept: https://lumalabs.ai/embed/UUID
  //         https://lumalabs.ai/capture/UUID
  //         https://lumalabs.ai/scene/UUID
  //         Raw UUID
  const lumaBase = 'https://lumalabs.ai/embed/';
  if (url.startsWith(lumaBase)) return url;
  const match = url.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (match) return `${lumaBase}${match[0]}`;
  // Fallback: replace known paths
  return url
    .replace('lumalabs.ai/capture/', 'lumalabs.ai/embed/')
    .replace('lumalabs.ai/scene/', 'lumalabs.ai/embed/');
}

export default function LumaEmbedViewer({ asset }: LumaEmbedViewerProps): JSX.Element {
  const embedUrl = toEmbedUrl(asset.url);

  return (
    <div className="relative h-full w-full bg-black">
      <iframe
        src={embedUrl}
        className="h-full w-full border-0"
        allow="autoplay; fullscreen; xr-spatial-tracking"
        title="Luma 3D Scene"
        loading="lazy"
      />
      {/* Luma attribution */}
      <a
        href="https://lumalabs.ai"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-2 right-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-bold text-white/70 backdrop-blur hover:text-white"
      >
        via Luma AI
      </a>
    </div>
  );
}
