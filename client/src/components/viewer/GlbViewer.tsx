import { useEffect, useState } from 'react';

/**
 * Augment JSX so TypeScript recognises <model-viewer> as a valid element.
 * @google/model-viewer registers itself as a custom element at runtime.
 */
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': {
        src?: string;
        alt?: string;
        /** Presence enables AR (ARCore / ARKit / Quick Look). */
        ar?: string;
        /**
         * Space-separated list of AR backends tried in order.
         * 'webxr scene-viewer quick-look' covers Android + iOS without an app.
         */
        'ar-modes'?: string;
        /**
         * 'auto' lets the device decide the initial scale.
         * 'fixed' keeps the model at its authored scale (better for furniture/rooms).
         */
        'ar-scale'?: string;
        /** Presence enables auto-rotation. */
        'auto-rotate'?: string;
        /** Presence enables mouse / touch camera control. */
        'camera-controls'?: string;
        style?: React.CSSProperties;
        class?: string;
        children?: React.ReactNode;
      };
    }
  }
}

interface GlbViewerProps {
  /** URL of the .glb / .gltf file to display (required). */
  src: string;
  /** Accessible label for the 3D model. */
  alt?: string;
  /**
   * Enable the native AR button.
   * - Android: opens Google Scene Viewer (no app required, Chrome 81+).
   * - iOS 12+: opens AR Quick Look (no app required, Safari).
   * - Desktop / unsupported: model-viewer hides the button automatically — no broken UI.
   */
  ar?: boolean;
  /** Slowly rotate the model on its Y-axis. */
  autoRotate?: boolean;
  /** Allow the user to orbit the camera with mouse / touch. */
  cameraControls?: boolean;
  /** Extra Tailwind classes applied to the outer wrapper div. */
  className?: string;
}

type LoadStatus = 'loading' | 'ready' | 'error';

/**
 * Lazy-loads @google/model-viewer via a dynamic import so the hefty
 * web-component bundle is only fetched when a MESH asset is shown.
 *
 * AR is mobile-first by design:
 * - The "Ver en tu espacio" button only renders when the browser supports AR.
 * - model-viewer handles the capability check internally — no JS feature detection needed.
 * - On desktop or unsupported mobile browsers the 3D experience is identical; the AR
 *   button simply never appears. No errors, no empty states, no broken UI.
 */
export default function GlbViewer({
  src,
  alt = 'Modelo 3D',
  ar = false,
  autoRotate = true,
  cameraControls = true,
  className = '',
}: GlbViewerProps): JSX.Element {
  const [status, setStatus] = useState<LoadStatus>('loading');

  useEffect(() => {
    let cancelled = false;

    import('@google/model-viewer')
      .then(() => {
        if (!cancelled) setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      className={`relative overflow-hidden rounded-[1.5rem] bg-slate-100 dark:bg-slate-800 ${className}`}
      style={{ minHeight: 300 }}
    >
      {/* ── Loading placeholder ─────────────────────────────────── */}
      {status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-300 border-t-violet-500" />
          <p className="text-xs font-bold text-slate-400">Cargando modelo 3D…</p>
        </div>
      )}

      {/* ── Hard error — graceful fallback, never a blank screen ── */}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8 text-slate-300">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
          </svg>
          <p className="text-sm font-bold text-slate-400">No se pudo cargar el modelo 3D</p>
          <p className="text-xs text-slate-400">Comprueba tu conexión e intenta de nuevo</p>
        </div>
      )}

      {/* ── model-viewer — only mounted when the module is ready ── */}
      {status === 'ready' && (
        <model-viewer
          src={src}
          alt={alt}
          /* AR attributes — present only when ar=true */
          ar={ar ? '' : undefined}
          ar-modes={ar ? 'webxr scene-viewer quick-look' : undefined}
          ar-scale={ar ? 'auto' : undefined}
          auto-rotate={autoRotate ? '' : undefined}
          camera-controls={cameraControls ? '' : undefined}
          style={{ width: '100%', height: '100%', minHeight: 300 }}
        >
          {/*
           * Custom AR button slot — model-viewer only renders this when:
           *   1. ar prop is true (we enable it), AND
           *   2. the device / browser supports AR (model-viewer checks internally).
           *
           * On desktop or unsupported mobile: this button is NEVER shown.
           * No JS media queries needed — model-viewer handles capability detection.
           *
           * Inline styles required: this renders inside the model-viewer shadow root,
           * Tailwind classes have no effect here.
           */}
          {ar && (
            <button
              slot="ar-button"
              style={{
                position: 'absolute',
                bottom: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '13px 22px',
                background: 'rgba(15,23,42,0.90)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.18)',
                borderRadius: '100px',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: '700',
                fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
                letterSpacing: '-0.01em',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                zIndex: 10,
                boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
              }}
            >
              {/* AR / 3D cube icon */}
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
              </svg>
              Ver en tu espacio
            </button>
          )}
        </model-viewer>
      )}
    </div>
  );
}
