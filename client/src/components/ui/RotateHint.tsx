/**
 * RotateHint — subtle landscape orientation nudge for the fullscreen mobile viewer.
 *
 * Rules:
 * - Renders ONLY when the device is in portrait orientation.
 * - Disappears automatically after 3 seconds.
 * - Disappears immediately if the device rotates to landscape.
 * - If the device is already in landscape when mounted: never appears.
 * - No localStorage — the chip is non-intrusive enough to show each visit.
 * - No dark overlay, no blocking — the tour remains fully interactive behind it.
 */
import { useEffect, useState } from 'react';

export default function RotateHint(): JSX.Element | null {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait)');

    // Only show if currently in portrait.
    if (!mq.matches) return;

    setVisible(true);

    // Auto-dismiss after 3 s.
    const timer = setTimeout(() => setVisible(false), 3000);

    // Dismiss immediately when the device rotates to landscape.
    function onOrientationChange(e: MediaQueryListEvent): void {
      if (!e.matches) setVisible(false); // e.matches = portrait; !matches = landscape
    }

    mq.addEventListener('change', onOrientationChange);

    return () => {
      clearTimeout(timer);
      mq.removeEventListener('change', onOrientationChange);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute left-1/2 top-16 z-50 -translate-x-1/2"
      style={{ animation: 'rotatehint-in 0.3s ease both' }}
    >
      {/* Keyframe injected once via a <style> tag — no Tailwind plugin needed */}
      <style>{`
        @keyframes rotatehint-in {
          from { opacity: 0; transform: translateX(-50%) translateY(-6px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes rotatehint-phone {
          0%, 100% { transform: rotate(0deg);  }
          45%      { transform: rotate(90deg); }
          55%      { transform: rotate(90deg); }
        }
      `}</style>

      <div className="flex items-center gap-2.5 rounded-full border border-white/20 bg-black/60 px-4 py-2 shadow-lg backdrop-blur-md">
        {/* Animated phone icon */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ animation: 'rotatehint-phone 2.4s ease-in-out infinite', transformOrigin: 'center' }}
          aria-hidden="true"
        >
          {/* Phone body */}
          <rect x="5" y="2" width="14" height="20" rx="2" />
          {/* Home indicator */}
          <line x1="10" y1="19" x2="14" y2="19" />
        </svg>

        <span className="text-xs font-bold text-white/90 tracking-tight">
          Mejor en horizontal
        </span>

        {/* Dismiss button — restores pointer-events only for this element */}
        <button
          type="button"
          onClick={() => setVisible(false)}
          aria-label="Cerrar sugerencia"
          className="pointer-events-auto ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-white/50 transition hover:text-white"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
            <path d="M1.41 0 5 3.59 8.59 0 10 1.41 6.41 5 10 8.59 8.59 10 5 6.41 1.41 10 0 8.59 3.59 5 0 1.41z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
