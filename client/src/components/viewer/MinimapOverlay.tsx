/**
 * MinimapOverlay — contextual spatial orientation, not a permanent HUD.
 *
 * Appears briefly (driven by `visible` prop from parent) when the user
 * navigates between spaces, then fades out automatically.
 * Shows the floorplan image with a dot at each space's floorplanPin position.
 *
 * Design principles:
 *  - Apple / Airbnb Luxe aesthetic: subtle, elegant, never gamey
 *  - pointer-events-none: never intercepts clicks
 *  - Hidden on screens < 480px (too small to be useful)
 *  - Respects prefers-reduced-motion
 */

import type { Space } from '@/types/viewer';

interface MinimapOverlayProps {
  floorplanUrl: string;
  spaces: Space[];
  activeSpaceId: string;
  visible: boolean;
  primaryColor: string;
  prefersReducedMotion: boolean;
}

export default function MinimapOverlay({
  floorplanUrl,
  spaces,
  activeSpaceId,
  visible,
  primaryColor,
  prefersReducedMotion,
}: MinimapOverlayProps): JSX.Element | null {
  // Derive active space for label
  const activeSpace = spaces.find((s) => s.id === activeSpaceId);

  // No floorplan → nothing to show (guard, parent should also check)
  if (!floorplanUrl) return null;

  const transitionIn  = prefersReducedMotion ? 'opacity 150ms ease'        : 'opacity 300ms ease, transform 300ms cubic-bezier(0.2,0,0,1)';
  const transitionOut = prefersReducedMotion ? 'opacity 300ms ease'        : 'opacity 500ms ease, transform 500ms cubic-bezier(0.4,0,1,1)';

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute bottom-24 left-5 z-20 hidden min-[480px]:block"
      style={{
        opacity:    visible ? 1 : 0,
        transform:  prefersReducedMotion
          ? undefined
          : visible ? 'translateY(0px)' : 'translateY(6px)',
        transition: visible ? transitionIn : transitionOut,
      }}
    >
      {/* ── Card ─────────────────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-2xl"
        style={{
          width:     160,
          height:    160,
          background: '#08080f',
          boxShadow: '0 12px 40px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.07)',
        }}
      >
        {/* Floorplan image — semi-transparent so dots are readable */}
        <img
          src={floorplanUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{ opacity: 0.55 }}
          draggable={false}
        />

        {/* ── Space pins ─────────────────────────────────────────────────────── */}
        {spaces.map((space) => {
          const pin = space.floorplanPin;
          if (!pin) return null;
          const isActive = space.id === activeSpaceId;

          return (
            <span
              key={space.id}
              className="absolute"
              style={{
                left:      `${pin.x}%`,
                top:       `${pin.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              {isActive ? (
                /* Active space: pulse ring + solid dot in brand colour */
                <span className="relative flex h-4 w-4 items-center justify-center">
                  {/* Pulse ring — skips animation when reduced-motion */}
                  <span
                    className="absolute inset-0 rounded-full"
                    style={{
                      backgroundColor: primaryColor,
                      opacity: 0.30,
                      animation: prefersReducedMotion
                        ? 'none'
                        : 'mm-ping 1.8s cubic-bezier(0,0,0.2,1) infinite',
                    }}
                  />
                  <span
                    className="relative z-10 h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: primaryColor }}
                  />
                </span>
              ) : (
                /* Other spaces: dim dot for spatial context */
                <span
                  className="block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: 'rgba(255,255,255,0.30)' }}
                />
              )}
            </span>
          );
        })}

        {/* ── Label gradient + space name ────────────────────────────────────── */}
        <div
          className="absolute inset-x-0 bottom-0 px-3 pb-2.5 pt-6"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.80) 0%, transparent 100%)' }}
        >
          <p
            className="truncate text-[9px] font-bold uppercase tracking-[0.22em]"
            style={{ color: 'rgba(255,255,255,0.50)' }}
          >
            {activeSpace?.name ?? ''}
          </p>
        </div>
      </div>

      {/* Ping keyframe — injected once per render, CSS handles it */}
      <style>{`
        @keyframes mm-ping {
          0%        { transform: scale(1);   opacity: 0.30; }
          70%, 100% { transform: scale(2.2); opacity: 0;    }
        }
      `}</style>
    </div>
  );
}
