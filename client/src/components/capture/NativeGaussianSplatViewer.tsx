import { useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { GaussianSplatRenderer } from '@/engines/GaussianSplatRenderer';
import type { GaussianSplatPickResult } from '@/engines/GaussianSplatRenderer';
import type { CaptureHotspotPosition } from '@/types/api';

interface Native3dPosition {
  mode: 'native_3d';
  x: number;
  y: number;
  z: number;
  picking?: 'spark_raycast' | 'approximate_ray' | 'manual' | 'unknown';
  confidence?: 'high' | 'medium' | 'low';
}

export interface NativeGaussianSplatHotspot {
  id: string;
  label: string;
  position: CaptureHotspotPosition | null;
}

interface NativeGaussianSplatViewerProps {
  assetUrl: string;
  hotspots: NativeGaussianSplatHotspot[];
  activeHotspotId: string | null;
  onHotspotClick: (hotspotId: string) => void;
  mode?: 'view' | 'edit';
  onPickPoint?: (pointData: GaussianSplatPickResult) => void;
  className?: string;
  enableApproximatePicking?: boolean;
}

function isNative3dPosition(value: CaptureHotspotPosition | null): value is Native3dPosition {
  return Boolean(
    value &&
    typeof value === 'object' &&
    (value as Native3dPosition).mode === 'native_3d' &&
    typeof (value as Native3dPosition).x === 'number' &&
    typeof (value as Native3dPosition).y === 'number' &&
    typeof (value as Native3dPosition).z === 'number'
  );
}

export default function NativeGaussianSplatViewer({
  assetUrl,
  hotspots,
  activeHotspotId,
  onHotspotClick,
  mode = 'view',
  onPickPoint,
  className = '',
  enableApproximatePicking = false
}: NativeGaussianSplatViewerProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<GaussianSplatRenderer | null>(null);
  const frameRef = useRef<number>(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [pickNotice, setPickNotice] = useState('');
  const [projectedHotspots, setProjectedHotspots] = useState<Array<{ id: string; label: string; left: number; top: number; visible: boolean }>>([]);

  const nativeHotspots = useMemo(() => hotspots.filter((hotspot) => isNative3dPosition(hotspot.position)), [hotspots]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    let disposed = false;
    setStatus('loading');
    setErrorMessage('');
    setPickNotice('');

    const renderer = new GaussianSplatRenderer({
      container,
      assetUrl,
      onReady: () => {
        if (disposed) return;
        setStatus('ready');
      },
      onError: (error) => {
        if (disposed) return;
        setStatus('error');
        setErrorMessage(error.message || 'No se pudo cargar el splat experimental.');
      }
    });

    rendererRef.current = renderer;
    void renderer.load(assetUrl);

    function onResize(): void {
      renderer.resize();
    }

    function projectLoop(): void {
      frameRef.current = requestAnimationFrame(projectLoop);
      const next = nativeHotspots.map((hotspot) => {
        const position = hotspot.position as Native3dPosition;
        const projected = renderer.projectPointToScreen(position);
        return {
          id: hotspot.id,
          label: hotspot.label,
          left: projected?.left ?? 0,
          top: projected?.top ?? 0,
          visible: Boolean(projected?.visible)
        };
      });
      setProjectedHotspots(next);
    }

    window.addEventListener('resize', onResize);
    projectLoop();

    return () => {
      disposed = true;
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(frameRef.current);
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [assetUrl, nativeHotspots]);

  function handlePick(event: React.PointerEvent<HTMLDivElement>): void {
    if (mode !== 'edit' || !onPickPoint || status !== 'ready') return;
    const result = rendererRef.current?.pickPointFromClient(event.clientX, event.clientY, enableApproximatePicking);
    if (!result) {
      setPickNotice('SparkJS no devolvio interseccion real para este punto.');
      return;
    }
    setPickNotice(result.picking === 'spark_raycast'
      ? 'Picking real SparkJS capturado.'
      : 'Posicion 3D aproximada. El picking real sobre splats requiere soporte especifico del viewer.');
    onPickPoint(result);
  }

  return (
    <div className={`relative h-full min-h-[360px] w-full overflow-hidden bg-black text-white ${className}`}>
      <div ref={containerRef} className="absolute inset-0" onPointerDown={handlePick} />

      {status === 'loading' ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70">
          <p className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-white/70">Cargando splat experimental...</p>
        </div>
      ) : null}

      {status === 'error' ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 p-5 text-center">
          <div className="max-w-sm rounded-xl border border-white/10 bg-white/10 p-4">
            <p className="text-sm font-black">Viewer Splat experimental no disponible</p>
            <p className="mt-2 text-xs font-semibold leading-5 text-white/55">{errorMessage}</p>
          </div>
        </div>
      ) : null}

      {projectedHotspots.map((hotspot) => hotspot.visible ? (
        <button
          key={hotspot.id}
          type="button"
          onClick={() => onHotspotClick(hotspot.id)}
          className={`absolute z-30 -translate-x-1/2 -translate-y-1/2 rounded-full border px-2.5 py-1 text-[10px] font-black shadow-lg backdrop-blur ${activeHotspotId === hotspot.id ? 'border-fuchsia-300 bg-fuchsia-500 text-white' : 'border-white/25 bg-black/65 text-white'}`}
          style={{ left: hotspot.left, top: hotspot.top }}
          title={hotspot.label}
        >
          3D
        </button>
      ) : null)}

      <div className="absolute right-3 top-3 z-30 flex flex-wrap gap-2">
        {mode === 'edit' ? (
          <span className="rounded-full border border-amber-300/40 bg-amber-400/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-amber-100">
            Picking experimental
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => rendererRef.current?.resetView()}
          className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/60 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white/75 hover:bg-black"
        >
          <RotateCcw className="h-3 w-3" /> Reset
        </button>
      </div>

      {pickNotice ? (
        <p className="absolute bottom-3 left-3 right-3 z-30 rounded-lg border border-white/10 bg-black/70 px-3 py-2 text-xs font-bold text-white/70">
          {pickNotice}
        </p>
      ) : null}
    </div>
  );
}
