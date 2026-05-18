import { useRef } from 'react';

interface FloorplanPinEditorProps {
  /** URL of the floorplan image (from the parent property) */
  floorplanUrl: string;
  /** Current pin X as a string ('0'–'100', or '' if unset) */
  pinX: string;
  /** Current pin Y as a string ('0'–'100', or '' if unset) */
  pinY: string;
  /** Space name shown in the pin label */
  spaceName: string;
  /** Called with new (x, y) strings, or ('', '') to clear the pin */
  onChange: (x: string, y: string) => void;
}

/**
 * Visual click-to-place floorplan pin editor.
 *
 * The image renders at its natural aspect ratio (w-full, h-auto) so there is
 * no object-contain letterbox — click coordinates map 1-to-1 to x%/y%.
 */
export default function FloorplanPinEditor({
  floorplanUrl,
  pinX,
  pinY,
  spaceName,
  onChange
}: FloorplanPinEditorProps): JSX.Element {
  const imgRef = useRef<HTMLImageElement>(null);

  const hasPin  = pinX !== '' && pinY !== '';
  const pinXNum = parseFloat(pinX);
  const pinYNum = parseFloat(pinY);

  function handleImageClick(e: React.MouseEvent<HTMLImageElement>): void {
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width)  * 100;
    const y = ((e.clientY - rect.top)  / rect.height) * 100;
    const cx = Math.max(0, Math.min(100, x));
    const cy = Math.max(0, Math.min(100, y));
    onChange(cx.toFixed(1), cy.toFixed(1));
  }

  /* ── No floorplan URL yet ─────────────────────────────────────────────── */
  if (!floorplanUrl) {
    return (
      <div className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center">
        <p className="text-xs font-bold text-slate-400">
          Añade la URL del plano de planta en el formulario de la propiedad para activar el editor visual de pins
        </p>
      </div>
    );
  }

  /* ── Editor ───────────────────────────────────────────────────────────── */
  return (
    <div className="col-span-full">
      <span className="mb-1.5 block text-xs font-black text-slate-600">
        Pin en plano{' '}
        <span className="font-semibold text-slate-400">— haz clic para posicionar</span>
      </span>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-900">
        {/* Image — w-full so it fills the container with no letterbox */}
        <div className="relative">
          <img
            ref={imgRef}
            src={floorplanUrl}
            alt="Plano de la vivienda"
            className="block w-full cursor-crosshair select-none opacity-85"
            style={{ maxHeight: 300, objectFit: 'contain' }}
            draggable={false}
            onClick={handleImageClick}
          />

          {/* Existing pin */}
          {hasPin && !isNaN(pinXNum) && !isNaN(pinYNum) ? (
            <div
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${pinXNum}%`, top: `${pinYNum}%` }}
            >
              {/* Pulse ring */}
              <span className="absolute inset-0 animate-ping rounded-full bg-violet-500 opacity-40" />
              {/* Solid dot */}
              <span className="relative flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-violet-600 shadow-lg">
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
              </span>
              {/* Label */}
              <span className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg bg-violet-600 px-2.5 py-1 text-[0.6rem] font-black text-white shadow-md">
                {spaceName || 'Estancia'}
              </span>
            </div>
          ) : (
            /* No-pin hint overlay */
            <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-4">
              <p className="rounded-xl bg-slate-950/75 px-4 py-2 text-xs font-bold text-white/55 backdrop-blur-sm">
                Haz clic en el plano para colocar el pin
              </p>
            </div>
          )}
        </div>

        {/* Footer: coords + clear */}
        {hasPin ? (
          <div className="flex items-center justify-between border-t border-white/[0.08] px-4 py-2">
            <p className="text-[0.65rem] font-bold text-white/35">
              x: {pinXNum.toFixed(1)}% · y: {pinYNum.toFixed(1)}%
            </p>
            <button
              type="button"
              onClick={() => { onChange('', ''); }}
              className="text-[0.65rem] font-bold text-white/30 transition hover:text-red-400"
            >
              Quitar pin
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
