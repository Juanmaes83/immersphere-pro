import type { ViewerAsset } from '@/types/viewer';

interface SuperSplatEmbedViewerProps {
  asset: ViewerAsset;
}

/**
 * Normalizes SuperSplat scene URLs to the embeddable iframe format.
 *
 * Accepts:
 *   https://superspl.at/scene/SCENE_ID
 *   https://superspl.at/s?id=SCENE_ID
 *   Plain SCENE_ID (8-char hex, e.g. "91c1e47e")
 */
function toEmbedUrl(url: string): string {
  const embedBase = 'https://superspl.at/s?id=';

  // Already an embed URL
  if (url.startsWith(embedBase)) return url;

  // Scene page URL: https://superspl.at/scene/91c1e47e
  const sceneMatch = url.match(/superspl\.at\/scene\/([a-f0-9]+)/i);
  if (sceneMatch) return `${embedBase}${sceneMatch[1]}`;

  // Raw 8-char scene ID
  if (/^[a-f0-9]{8}$/i.test(url.trim())) return `${embedBase}${url.trim()}`;

  // Fallback: return as-is (covers future URL shapes)
  return url;
}

export default function SuperSplatEmbedViewer({ asset }: SuperSplatEmbedViewerProps): JSX.Element {
  const embedUrl = toEmbedUrl(asset.url);

  return (
    <div className="relative h-full w-full bg-black">
      <iframe
        src={embedUrl}
        className="h-full w-full border-0"
        allow="fullscreen; xr-spatial-tracking"
        title="Gaussian Splat 3D Scene"
        loading="lazy"
      />
    </div>
  );
}
