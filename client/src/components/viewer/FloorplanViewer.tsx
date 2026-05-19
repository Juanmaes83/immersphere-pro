import { useState } from 'react';
import type { Space } from '@/types/viewer';
import { t } from '@/i18n/dictionary';

interface FloorplanViewerProps {
  floorplanUrl: string;
  spaces: Space[];
  activeSpaceId: string;
  primaryColor: string;
  onSpaceClick: (spaceId: string) => void;
  lang?: string;
}

export default function FloorplanViewer({
  floorplanUrl,
  spaces,
  activeSpaceId,
  primaryColor,
  onSpaceClick,
  lang
}: FloorplanViewerProps): JSX.Element {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const pinnedSpaces = spaces.filter((s) => s.floorplanPin != null);

  return (
    <div className="relative flex min-h-[520px] items-center justify-center rounded-[1.5rem] bg-slate-900 p-4">
      {/* Floorplan image container — pins are positioned relative to this */}
      <div className="relative inline-block max-h-[480px] max-w-full">
        <img
          src={floorplanUrl}
          alt={t(lang, 'floorplan_alt')}
          className="block max-h-[480px] max-w-full rounded-2xl object-contain opacity-90 select-none"
          draggable={false}
        />

        {/* Space pins */}
        {pinnedSpaces.map((space) => {
          const isActive  = space.id === activeSpaceId;
          const isHovered = space.id === hoveredId;
          const pin = space.floorplanPin!;

          return (
            <button
              key={space.id}
              type="button"
              onClick={() => { onSpaceClick(space.id); }}
              onMouseEnter={() => { setHoveredId(space.id); }}
              onMouseLeave={() => { setHoveredId(null); }}
              className="absolute -translate-x-1/2 -translate-y-1/2 transition-transform active:scale-90"
              style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
              title={space.name}
            >
              {/* Active pulse ring — animate-ping creates a ripple without keyframes */}
              {isActive ? (
                <span
                  className="absolute inset-0 animate-ping rounded-full opacity-35"
                  style={{ backgroundColor: primaryColor }}
                />
              ) : null}

              {/* Pin circle */}
              <span
                className="relative flex h-7 w-7 items-center justify-center rounded-full shadow-lg transition-all duration-200"
                style={{
                  backgroundColor: isActive ? primaryColor : 'rgba(255,255,255,0.15)',
                  border: isActive
                    ? `3px solid ${primaryColor}`
                    : isHovered
                      ? '2px solid rgba(255,255,255,0.7)'
                      : '2px solid rgba(255,255,255,0.35)',
                  transform: isActive || isHovered ? 'scale(1.25)' : 'scale(1)',
                  boxShadow: isActive ? `0 0 0 4px ${primaryColor}33` : undefined,
                }}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: isActive ? '#fff' : 'rgba(255,255,255,0.7)' }}
                />
              </span>

              {/* Space name label — always visible on active, on hover otherwise */}
              {(isHovered || isActive) ? (
                <span
                  className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-black text-white shadow-xl"
                  style={{ backgroundColor: isActive ? primaryColor : 'rgba(15,23,42,0.92)' }}
                >
                  {space.name}
                </span>
              ) : null}
            </button>
          );
        })}

        {/* Empty state when no pins are configured */}
        {pinnedSpaces.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl bg-slate-950/60 backdrop-blur-sm">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/40">
              {t(lang, 'floorplan_no_pins')}
            </p>
            <p className="max-w-[220px] text-center text-[0.7rem] text-white/25">
              {t(lang, 'floorplan_no_pins_help')}
            </p>
          </div>
        ) : null}
      </div>

      {/* Legend */}
      {pinnedSpaces.length > 0 ? (
        <div className="absolute bottom-4 right-4 flex flex-col items-end gap-1">
          {spaces.filter((s) => s.floorplanPin).map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => { onSpaceClick(s.id); }}
              className={`rounded-full px-3 py-1 text-[0.65rem] font-black transition ${
                s.id === activeSpaceId
                  ? 'text-white'
                  : 'bg-white/10 text-white/50 hover:bg-white/15 hover:text-white/70'
              }`}
              style={s.id === activeSpaceId ? { backgroundColor: primaryColor } : undefined}
            >
              {s.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
