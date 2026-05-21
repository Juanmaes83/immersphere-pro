import { useCallback, useEffect, useRef, useState } from 'react';
import { api, unwrapApiResponse } from '@/services/api';
import { useAuthStore } from '@/store/authStore';

interface UploadAssetResponse {
  url: string;
}

interface AvatarWidgetProps {
  /** Size of the avatar circle in pixels */
  size?: number;
  /** Show name + role label next to avatar */
  showLabel?: boolean;
  primaryColor?: string;
}

type Mode = 'idle' | 'menu' | 'webcam' | 'preview' | 'uploading';

export default function AvatarWidget({
  size = 48,
  showLabel = false,
  primaryColor = '#7C3AED'
}: AvatarWidgetProps): JSX.Element {
  const user = useAuthStore((s) => s.user);
  const hydrateFromStorage = useAuthStore((s) => s.hydrateFromStorage);

  const [mode, setMode] = useState<Mode>('idle');
  const [error, setError] = useState<string | null>(null);
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const initials = user?.name?.slice(0, 1).toUpperCase() ?? '?';
  const avatarUrl = user?.avatarUrl;

  // ── Close menu on outside click ─────────────────────────────────────────────
  const handleOutside = useCallback((e: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
      setMode('idle');
    }
  }, []);

  useEffect(() => {
    if (mode === 'menu') {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [mode, handleOutside]);

  // ── Stop webcam on unmount or mode change ───────────────────────────────────
  useEffect(() => {
    if (mode !== 'webcam' && mode !== 'preview') {
      stopStream();
    }
  }, [mode]);

  useEffect(() => {
    return () => stopStream();
  }, []);

  function stopStream(): void {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  // ── Start webcam ─────────────────────────────────────────────────────────────
  async function startWebcam(): Promise<void> {
    setError(null);
    setMode('webcam');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setError('No se pudo acceder a la cámara. Comprueba los permisos del navegador.');
      setMode('menu');
    }
  }

  // ── Capture frame ────────────────────────────────────────────────────────────
  function capture(): void {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const size = Math.min(video.videoWidth, video.videoHeight);
    const offsetX = (video.videoWidth - size) / 2;
    const offsetY = (video.videoHeight - size) / 2;

    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, offsetX, offsetY, size, size, 0, 0, 512, 512);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedDataUrl(dataUrl);

    canvas.toBlob((blob) => {
      if (blob) setCapturedBlob(blob);
    }, 'image/jpeg', 0.9);

    stopStream();
    setMode('preview');
  }

  // ── Upload captured blob ─────────────────────────────────────────────────────
  async function uploadBlob(blob: Blob, filename: string): Promise<void> {
    setMode('uploading');
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', blob, filename);
      const upload = await unwrapApiResponse<UploadAssetResponse>(
        api.post('/uploads', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      );
      await unwrapApiResponse(api.patch('/auth/me/avatar', { avatarUrl: upload.url }));
      const stored = window.localStorage.getItem('user');
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, unknown>;
        parsed.avatarUrl = upload.url;
        window.localStorage.setItem('user', JSON.stringify(parsed));
        hydrateFromStorage();
      }
      setCapturedDataUrl(null);
      setCapturedBlob(null);
      setMode('idle');
    } catch {
      setError('Error al subir la imagen. Inténtalo de nuevo.');
      setMode('preview');
    }
  }

  // ── Handle file input ────────────────────────────────────────────────────────
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    await uploadBlob(file, file.name);
  }

  // ── Avatar circle ─────────────────────────────────────────────────────────────
  const avatarEl = (
    <button
      type="button"
      onClick={() => setMode((m) => m === 'menu' ? 'idle' : 'menu')}
      className="relative shrink-0 overflow-hidden rounded-full ring-2 ring-offset-2 transition hover:opacity-90 focus:outline-none"
      style={{ width: size, height: size }}
      aria-label="Cambiar foto de perfil"
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt={user?.name ?? ''} className="h-full w-full object-cover" />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center text-white font-black"
          style={{ backgroundColor: primaryColor, fontSize: size * 0.38 }}
        >
          {initials}
        </span>
      )}
      {/* Camera overlay hint */}
      <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 transition hover:bg-black/30">
        <svg className="h-4 w-4 text-white opacity-0 hover:opacity-100 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </span>
    </button>
  );

  return (
    <>
      <div className="relative flex items-center gap-3" ref={menuRef}>
        {avatarEl}

        {showLabel && (
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-slate-900 dark:text-white">{user?.name ?? 'Admin'}</p>
            <p className="text-xs font-bold text-slate-400">{user?.role === 'TENANTADMIN' ? 'Admin' : user?.role}</p>
          </div>
        )}

        {/* ── Dropdown menu ── */}
        {mode === 'menu' && (
          <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-52 overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
            <p className="px-4 pt-3 pb-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Foto de perfil</p>
            <label className="flex cursor-pointer items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700">
              <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Subir archivo
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(e) => { setMode('idle'); void handleFile(e); }}
              />
            </label>
            <button
              type="button"
              className="flex w-full items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700"
              onClick={() => { void startWebcam(); }}
            >
              <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Hacer foto
            </button>
            {error && <p className="px-4 pb-3 text-xs font-bold text-red-500">{error}</p>}
          </div>
        )}

        {mode === 'uploading' && (
          <div className="absolute left-0 top-[calc(100%+8px)] z-50 flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-xl ring-1 ring-slate-200">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-violet-600" />
            Subiendo foto...
          </div>
        )}
      </div>

      {/* ── Webcam / preview modal ── */}
      {(mode === 'webcam' || mode === 'preview') && (
        <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm overflow-hidden rounded-[2rem] bg-white shadow-2xl dark:bg-slate-900">

            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4">
              <p className="text-sm font-black text-slate-900 dark:text-white">
                {mode === 'webcam' ? 'Encuadra tu foto' : 'Confirmar foto'}
              </p>
              <button
                type="button"
                onClick={() => { stopStream(); setCapturedDataUrl(null); setCapturedBlob(null); setMode('idle'); }}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            {/* Camera / preview */}
            <div className="relative mx-6 overflow-hidden rounded-[1.4rem] bg-slate-950" style={{ aspectRatio: '1/1' }}>
              {mode === 'webcam' && (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="h-full w-full object-cover scale-x-[-1]"
                  />
                  {/* Circle guide */}
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="h-[75%] w-[75%] rounded-full border-2 border-white/40" />
                  </div>
                </>
              )}
              {mode === 'preview' && capturedDataUrl && (
                <img src={capturedDataUrl} alt="Captura" className="h-full w-full object-cover scale-x-[-1]" />
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            {/* Actions */}
            <div className="flex gap-3 px-6 py-5">
              {mode === 'webcam' && (
                <button
                  type="button"
                  onClick={capture}
                  className="flex-1 rounded-2xl py-3 text-sm font-black text-white transition hover:opacity-90"
                  style={{ backgroundColor: primaryColor }}
                >
                  Capturar
                </button>
              )}
              {mode === 'preview' && (
                <>
                  <button
                    type="button"
                    onClick={() => { setCapturedDataUrl(null); setCapturedBlob(null); void startWebcam(); }}
                    className="flex-1 rounded-2xl border border-slate-200 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                  >
                    Repetir
                  </button>
                  <button
                    type="button"
                    onClick={() => { if (capturedBlob) void uploadBlob(capturedBlob, 'avatar-webcam.jpg'); }}
                    className="flex-1 rounded-2xl py-3 text-sm font-black text-white transition hover:opacity-90"
                    style={{ backgroundColor: primaryColor }}
                  >
                    Usar esta foto
                  </button>
                </>
              )}
            </div>
            {error && <p className="px-6 pb-4 text-xs font-bold text-red-500">{error}</p>}
          </div>
        </div>
      )}
    </>
  );
}
