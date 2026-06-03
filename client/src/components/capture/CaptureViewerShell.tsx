import type { ReactNode } from 'react';
import { ExternalLink, Maximize2, X } from 'lucide-react';
import type { PublicCaptureJob } from '@/types/api';

const AUTO_HOTSPOT_POSITIONS = [
  { x: 20, y: 30 },
  { x: 75, y: 30 },
  { x: 30, y: 70 },
  { x: 70, y: 70 },
  { x: 50, y: 50 }
];

function statusLabel(value: string): string {
  return value.replace(/_/g, ' ');
}

function getPercentPosition(position: Record<string, unknown> | null, key: string): number | null {
  const value = position?.[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, value));
}

function getHotspotPosition(
  hotspot: PublicCaptureJob['hotspots'][number],
  index: number
): { x: number; y: number; mobileX: number; mobileY: number } {
  const fallback = AUTO_HOTSPOT_POSITIONS[index % AUTO_HOTSPOT_POSITIONS.length];
  const x = getPercentPosition(hotspot.position, 'x') ?? fallback.x;
  const y = getPercentPosition(hotspot.position, 'y') ?? fallback.y;
  return {
    x,
    y,
    mobileX: getPercentPosition(hotspot.position, 'mobileX') ?? x,
    mobileY: getPercentPosition(hotspot.position, 'mobileY') ?? y
  };
}

interface CaptureViewerShellProps {
  viewer: ReactNode;
  hotspots: PublicCaptureJob['hotspots'];
  activeHotspotId: string | null;
  isImmersive?: boolean;
  isMobileLike: boolean;
  isMobileLandscape: boolean;
  isMobilePortrait: boolean;
  title: string;
  subtitle: string;
  ctaLabel: string;
  externalUrl: string;
  showControls?: boolean;
  onHotspotClick: (hotspotId: string) => void;
  onCloseHotspot: () => void;
  onEnterImmersive: () => void;
  onExitImmersive: () => void;
}

export default function CaptureViewerShell({
  viewer,
  hotspots,
  activeHotspotId,
  isImmersive = false,
  isMobileLike,
  isMobileLandscape,
  isMobilePortrait,
  title,
  subtitle,
  ctaLabel,
  externalUrl,
  showControls = true,
  onHotspotClick,
  onCloseHotspot,
  onEnterImmersive,
  onExitImmersive
}: CaptureViewerShellProps): JSX.Element {
  const activeHotspot = hotspots.find((hotspot) => hotspot.id === activeHotspotId) ?? null;
  const isViewportShell = isImmersive || isMobileLandscape;

  const shellClass = !showControls && !isViewportShell
    ? 'contents'
    : isViewportShell
    ? 'capture-viewer-shell fixed inset-0 z-[80] flex h-[100dvh] w-screen flex-col overflow-hidden bg-black text-white'
    : 'overflow-hidden rounded-ip-card bg-slate-950 text-white ring-1 ring-slate-800 dark:bg-black dark:ring-white/10';

  const controlsClass = isViewportShell
    ? 'flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-black/65 px-[max(0.75rem,env(safe-area-inset-left))] py-2 pr-[max(0.75rem,env(safe-area-inset-right))] backdrop-blur'
    : 'flex flex-col gap-4 border-b border-white/10 px-5 py-4 md:flex-row md:items-center md:justify-between';

  const frameClass = isViewportShell
    ? 'relative min-h-0 flex-1 overflow-hidden bg-black'
    : isMobileLike
      ? 'relative h-[60dvh] min-h-[420px] w-full overflow-hidden bg-black'
      : 'relative aspect-[16/10] min-h-[320px] overflow-hidden bg-black';

  return (
    <section className={shellClass} aria-label="Experiencia 3D inmersiva">
      {showControls ? <div className={controlsClass}>
        <div className="min-w-0">
          <p className="truncate text-xs font-black uppercase tracking-[0.16em] text-violet-300">
            {isMobileLandscape && !isImmersive ? 'Modo horizontal activo' : 'Experiencia 3D inmersiva'}
          </p>
          <h2 className={`${isViewportShell ? 'truncate text-sm' : 'mt-1 text-2xl'} font-black`}>
            {subtitle}
          </h2>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {!isViewportShell ? (
            <a
              href={externalUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-violet-100"
            >
              {ctaLabel} <ExternalLink className="h-4 w-4" />
            </a>
          ) : (
            <a
              href={externalUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Abrir externo"
              title="Abrir externo"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/80 hover:bg-white/10"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}

          {isImmersive ? (
            <button
              type="button"
              onClick={onExitImmersive}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black text-slate-950"
            >
              <X className="h-4 w-4" /> Salir
            </button>
          ) : (
            <button
              type="button"
              onClick={onEnterImmersive}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs font-black text-white transition hover:bg-white/10 sm:px-5 sm:py-3 sm:text-sm"
            >
              <Maximize2 className="h-4 w-4" /> Modo inmersivo
            </button>
          )}
        </div>
      </div> : null}

      {showControls && isMobilePortrait && !isImmersive ? (
        <div className="border-b border-white/10 bg-violet-500/15 px-5 py-4">
          <p className="text-sm font-black text-white">Gira el movil para ver la experiencia en formato inmersivo.</p>
          <p className="mt-1 text-xs font-semibold text-white/60">En horizontal veras mejor estancias, proporciones, splats, panoramicas y videos inmersivos.</p>
        </div>
      ) : null}

      <div className={frameClass}>
        <div className="h-full w-full">{viewer}</div>
        {hotspots.length > 0 ? (
          <div className="pointer-events-none absolute inset-0">
            {hotspots.map((hotspot, index) => {
              const position = getHotspotPosition(hotspot, index);
              const left = isMobileLike ? position.mobileX : position.x;
              const top = isMobileLike ? position.mobileY : position.y;
              const isActive = activeHotspotId === hotspot.id;
              return (
                <button
                  key={hotspot.id}
                  type="button"
                  aria-label={`Ver hotspot ${hotspot.label}`}
                  onClick={() => onHotspotClick(hotspot.id)}
                  className={`pointer-events-auto absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-xs font-black shadow-[0_8px_30px_rgba(0,0,0,0.35)] ring-4 ring-black/20 transition hover:scale-110 focus:outline-none focus:ring-4 focus:ring-violet-300 sm:h-9 sm:w-9 ${isActive ? 'bg-ip-accent text-white' : 'bg-white text-slate-950 hover:bg-violet-100'}`}
                  style={{ left: `${left}%`, top: `${top}%` }}
                >
                  {index + 1}
                </button>
              );
            })}

            {activeHotspot ? (
              <div className={`pointer-events-auto absolute rounded-xl bg-white p-4 text-slate-950 shadow-2xl ring-1 ring-slate-200 ${isViewportShell ? 'inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] max-h-[34dvh] overflow-auto sm:left-auto sm:right-4 sm:w-80' : isMobileLike ? 'inset-x-3 bottom-3 max-h-[42dvh] overflow-auto' : 'right-4 top-4 w-80'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-ip-accent">
                      {activeHotspot.roomOrZone || statusLabel(activeHotspot.hotspotType)}
                    </p>
                    <h3 className="mt-1 text-base font-black">{activeHotspot.label}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={onCloseHotspot}
                    className="rounded-full border border-slate-200 px-2 py-1 text-[10px] font-black text-slate-500 hover:bg-slate-50"
                  >
                    Cerrar
                  </button>
                </div>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{activeHotspot.description}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">{activeHotspot.priority}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">{statusLabel(activeHotspot.hotspotType)}</span>
                </div>
                {activeHotspot.cta ? (
                  <button type="button" className="mt-4 w-full rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white">
                    {activeHotspot.cta}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {isViewportShell ? (
        <div className="sr-only">
          <p>{title}</p>
        </div>
      ) : null}
    </section>
  );
}
