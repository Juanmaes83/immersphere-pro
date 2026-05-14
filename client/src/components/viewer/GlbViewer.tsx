import { useEffect, useState } from 'react';

// Augment JSX so TypeScript recognises <model-viewer> as a valid element.
// @google/model-viewer registers itself as a custom element at runtime;
// the types here match the attributes actually used by this component.
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': {
        src?: string;
        alt?: string;
        /** Presence enables AR (ARCore / ARKit). Pass '' when enabled. */
        ar?: string;
        /** Presence enables auto-rotation. Pass '' when enabled. */
        'auto-rotate'?: string;
        /** Presence enables mouse / touch camera control. Pass '' when enabled. */
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
  /** Enable native AR mode (ARCore on Android, AR Quick Look on iOS). */
  ar?: boolean;
  /** Slowly rotate the model on its Y-axis. */
  autoRotate?: boolean;
  /** Allow the user to orbit the camera with mouse / touch. */
  cameraControls?: boolean;
  /** Extra Tailwind classes applied to the outer wrapper. */
  className?: string;
}

type LoadStatus = 'loading' | 'ready' | 'error';

/**
 * Lazy-loads @google/model-viewer via a dynamic import so the hefty
 * web-component bundle is only fetched when a MESH asset is shown.
 * While the module loads the component displays a neutral placeholder;
 * on error it shows a friendly message — no hard crash.
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
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-sm font-bold text-slate-400">Cargando modelo 3D...</p>
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
          <p className="text-sm font-bold text-slate-400">No se pudo cargar el modelo 3D</p>
        </div>
      )}

      {status === 'ready' && (
        <model-viewer
          src={src}
          alt={alt}
          ar={ar ? '' : undefined}
          auto-rotate={autoRotate ? '' : undefined}
          camera-controls={cameraControls ? '' : undefined}
          style={{ width: '100%', height: '100%', minHeight: 300 }}
        />
      )}
    </div>
  );
}
