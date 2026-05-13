import { useEffect, useRef, useState } from 'react';

interface Point3D { x: number; y: number; z: number }

interface MeasurementPoint {
  pctX: number;
  pctY: number;
  world: Point3D;
}

interface MeasurementOverlayProps {
  active: boolean;
  getPoint3D: (relX: number, relY: number, w: number, h: number) => Point3D | null;
  scaleToMeters: number;
}

function dist3d(a: Point3D, b: Point3D): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2 + (b.z - a.z) ** 2);
}

export default function MeasurementOverlay({
  active,
  getPoint3D,
  scaleToMeters
}: MeasurementOverlayProps): JSX.Element {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [points, setPoints] = useState<MeasurementPoint[]>([]);

  useEffect(() => {
    if (!active) setPoints([]);
  }, [active]);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>): void {
    if (!active) return;
    e.stopPropagation();
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return;
    const relX = e.clientX - rect.left;
    const relY = e.clientY - rect.top;
    const world = getPoint3D(relX, relY, rect.width, rect.height);
    if (!world) return;
    const pctX = (relX / rect.width) * 100;
    const pctY = (relY / rect.height) * 100;
    setPoints((prev) =>
      prev.length >= 2 ? [{ pctX, pctY, world }] : [...prev, { pctX, pctY, world }]
    );
  }

  const rawDist = points.length === 2 ? dist3d(points[0].world, points[1].world) : null;
  const distMeters = rawDist !== null ? rawDist * scaleToMeters : null;
  const midX = points.length === 2 ? (points[0].pctX + points[1].pctX) / 2 : 0;
  const midY = points.length === 2 ? (points[0].pctY + points[1].pctY) / 2 : 0;

  return (
    <div
      ref={overlayRef}
      onPointerDown={handlePointerDown}
      className="absolute inset-0 z-50"
      style={{ pointerEvents: active ? 'all' : 'none', cursor: active ? 'crosshair' : 'default' }}
    >
      {/* SVG line between points */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ pointerEvents: 'none' }}
      >
        {points.length === 2 && (
          <line
            x1={points[0].pctX}
            y1={points[0].pctY}
            x2={points[1].pctX}
            y2={points[1].pctY}
            stroke="rgba(255,255,255,0.85)"
            strokeWidth="0.4"
            strokeDasharray="2 1"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      {/* Point A / B dots */}
      {points.map((p, i) => (
        <div
          key={i}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${p.pctX}%`, top: `${p.pctY}%`, pointerEvents: 'none' }}
        >
          <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-violet-600 shadow-lg">
            <span className="text-[8px] font-black text-white">{i === 0 ? 'A' : 'B'}</span>
          </div>
        </div>
      ))}

      {/* Distance label */}
      {distMeters !== null && (
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-xl border border-white/20 bg-black/80 px-3 py-1.5 text-sm font-black text-white backdrop-blur"
          style={{ left: `${midX}%`, top: `${midY}%`, pointerEvents: 'none' }}
        >
          ≈ {distMeters.toFixed(1)} m (estimado)
        </div>
      )}

      {/* Instruction hint */}
      {active && (
        <div
          className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-2xl border border-white/10 bg-black/70 px-4 py-2 text-xs font-bold text-white backdrop-blur"
          style={{ pointerEvents: 'none' }}
        >
          {points.length === 0
            ? 'Clic en el punto A'
            : points.length === 1
              ? 'Clic en el punto B'
              : 'Clic para nueva medición'}
        </div>
      )}
    </div>
  );
}
