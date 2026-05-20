import { useRef, useState, useEffect } from 'react';

interface PropertyVideoHeroProps {
  videoUrl: string;
  posterUrl?: string;
  /** Optional CSS class appended to the outermost wrapper. */
  className?: string;
}

/**
 * PropertyVideoHero — Micro-PR 2
 *
 * Renders a premium, mobile-safe video player for the property hero section.
 * Only mounts when `videoUrl` is non-empty. No external libraries.
 *
 * Features:
 * - Custom play/pause, mute/unmute, fullscreen controls
 * - playsInline — prevents iOS auto-fullscreen
 * - muted + preload="metadata" — no autoplay with sound, no eager download
 * - Poster fallback (heroVideoPoster → coverImage → blank)
 * - prefers-reduced-motion: respects system preference
 */
export default function PropertyVideoHero({ videoUrl, posterUrl = '', className = '' }: PropertyVideoHeroProps): JSX.Element | null {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);

  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Sync fullscreen state
  useEffect(() => {
    const onFsChange = (): void => { setIsFullscreen(!!document.fullscreenElement); };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => { document.removeEventListener('fullscreenchange', onFsChange); };
  }, []);

  // Sync play/pause state with native video events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay  = (): void => { setIsPlaying(true);  setShowOverlay(false); };
    const onPause = (): void => { setIsPlaying(false); setShowOverlay(true); };
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
    };
  }, []);

  if (!videoUrl) return null;

  function handlePlayPause(): void {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
    } else {
      video.pause();
    }
  }

  function handleMute(): void {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }

  function handleFullscreen(): void {
    try {
      if (!document.fullscreenElement) {
        void wrapperRef.current?.requestFullscreen();
      } else {
        void document.exitFullscreen();
      }
    } catch { /* fullscreen not available */ }
  }

  return (
    <div
      ref={wrapperRef}
      className={`relative overflow-hidden rounded-[1.6rem] bg-slate-950 shadow-lg ${className}`}
      style={{ aspectRatio: '16/9' }}
    >
      {/* ── Video element ────────────────────────────────────────────────── */}
      <video
        ref={videoRef}
        src={videoUrl}
        poster={posterUrl || undefined}
        className="h-full w-full object-cover"
        playsInline
        muted
        loop
        preload="metadata"
        style={{ display: 'block' }}
      />

      {/* ── Gradient overlay (bottom fade) ──────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

      {/* ── Big play button overlay (shown when paused) ──────────────────── */}
      {showOverlay ? (
        <button
          type="button"
          onClick={handlePlayPause}
          className="absolute inset-0 flex items-center justify-center transition-opacity hover:opacity-80"
          aria-label="Reproducir vídeo"
        >
          <div
            className={`flex h-16 w-16 items-center justify-center rounded-full bg-white/20 ring-2 ring-white/40 backdrop-blur-md md:h-20 md:w-20 ${prefersReducedMotion ? '' : 'transition-transform hover:scale-105'}`}
          >
            {/* Play triangle */}
            <svg className="ml-1 h-7 w-7 text-white md:h-9 md:w-9" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </button>
      ) : null}

      {/* ── Bottom control bar ───────────────────────────────────────────── */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-4 py-3 md:px-5">
        {/* Play / Pause */}
        <button
          type="button"
          onClick={handlePlayPause}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/70 active:scale-95 md:h-10 md:w-10"
          aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
        >
          {isPlaying ? (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          ) : (
            <svg className="ml-0.5 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <div className="flex items-center gap-2">
          {/* Mute / Unmute */}
          <button
            type="button"
            onClick={handleMute}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/70 active:scale-95 md:h-10 md:w-10"
            aria-label={isMuted ? 'Activar sonido' : 'Silenciar'}
          >
            {isMuted ? (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
              </svg>
            )}
          </button>

          {/* Fullscreen */}
          <button
            type="button"
            onClick={handleFullscreen}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/70 active:scale-95 md:h-10 md:w-10"
            aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          >
            {isFullscreen ? (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
