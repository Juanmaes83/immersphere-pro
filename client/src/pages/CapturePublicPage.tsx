import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { api, getApiErrorMessage, unwrapApiResponse } from '@/services/api';
import type { PublicCaptureJob } from '@/types/api';

const PREMIUM_3D_PRIORITY = ['gaussian_splat', 'splat_viewer', 'supersplat', 'spark_viewer', 'external_3d_viewer'];

function statusLabel(value: string): string {
  return value.replace(/_/g, ' ');
}

function isSafeHttpUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeSuperSplatUrl(rawUrl: string): string {
  const embedBase = 'https://superspl.at/s?id=';
  if (rawUrl.startsWith(embedBase)) return rawUrl;
  const sceneMatch = rawUrl.match(/superspl\.at\/scene\/([a-f0-9]+)/i);
  if (sceneMatch) return `${embedBase}${sceneMatch[1]}`;
  return rawUrl;
}

function toEmbedUrl(rawUrl: string, type: string): string {
  if (type === 'supersplat' || type === 'splat_viewer' || type === 'gaussian_splat') {
    return normalizeSuperSplatUrl(rawUrl);
  }
  return rawUrl;
}

export default function CapturePublicPage(): JSX.Element {
  const { id } = useParams();
  const [job, setJob] = useState<PublicCaptureJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!id) {
      setError('CaptureJob no encontrado.');
      setLoading(false);
      return;
    }
    unwrapApiResponse<PublicCaptureJob>(api.get(`/capture-jobs/public/${id}`))
      .then((data) => {
        if (!cancelled) setJob(data);
      })
      .catch((err) => {
        if (!cancelled) setError(getApiErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-5xl items-center justify-center px-5 py-16">
        <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">Cargando experiencia...</p>
      </main>
    );
  }

  if (error || !job) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-5xl flex-col items-center justify-center px-5 py-16 text-center">
        <Helmet><title>Capture no disponible · Immersphere Pro</title></Helmet>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-red-500">No disponible</p>
        <h1 className="mt-3 text-3xl font-black text-slate-950 dark:text-white">Esta entrega no esta publicada</h1>
        <p className="mt-3 max-w-md text-sm font-semibold text-slate-500 dark:text-white/45">{error ?? 'Revisa el enlace o solicita acceso al equipo responsable.'}</p>
        <Link to="/" className="mt-6 rounded-full bg-ip-accent px-5 py-2 text-sm font-black text-white">Volver</Link>
      </main>
    );
  }

  const premiumOutput = [...job.outputAssets]
    .filter((asset) => asset.isPremium3d)
    .sort((a, b) => {
      const ai = PREMIUM_3D_PRIORITY.indexOf(a.type);
      const bi = PREMIUM_3D_PRIORITY.indexOf(b.type);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    })[0] ?? null;
  const primaryOutput = premiumOutput ?? job.outputAssets[0] ?? null;
  const primaryUrl = primaryOutput?.url ?? job.publicUrl;
  const canEmbedPrimary = Boolean(
    premiumOutput &&
    premiumOutput.embeddable &&
    primaryUrl &&
    isSafeHttpUrl(primaryUrl)
  );

  return (
    <main className="mx-auto max-w-5xl px-5 py-12">
      <Helmet>
        <title>{job.title} · Immersphere Pro</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <section className="border-b border-slate-200 pb-8 dark:border-white/10">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-ip-accent">Entrega visual publicada</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-tight text-slate-950 dark:text-white">{job.title}</h1>
        <p className="mt-3 text-lg font-semibold text-slate-500 dark:text-white/45">{job.clientName}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-800/50">{statusLabel(job.status)}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-slate-600 ring-1 ring-slate-200 dark:bg-white/5 dark:text-white/60 dark:ring-white/10">{job.projectType}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-slate-600 ring-1 ring-slate-200 dark:bg-white/5 dark:text-white/60 dark:ring-white/10">{job.vertical}</span>
        </div>
      </section>

      <section className="mt-8 grid gap-4">
        {premiumOutput ? (
          <div className="overflow-hidden rounded-ip-card bg-slate-950 text-white ring-1 ring-slate-800 dark:bg-black dark:ring-white/10">
            <div className="flex flex-col gap-4 border-b border-white/10 px-5 py-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-300">Experiencia 3D inmersiva</p>
                <h2 className="mt-1 text-2xl font-black">{statusLabel(premiumOutput.type)}</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-violet-500/20 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-violet-100 ring-1 ring-violet-300/30">3D / Gaussian / Splat</span>
                  {premiumOutput.viewerReady ? <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-emerald-100 ring-1 ring-emerald-300/30">Desktop OK</span> : null}
                  {premiumOutput.mobileReady ? <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-emerald-100 ring-1 ring-emerald-300/30">Mobile OK</span> : null}
                </div>
              </div>
              <a href={primaryUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-violet-100">
                Abrir experiencia 3D <ExternalLink className="h-4 w-4" />
              </a>
            </div>
            {canEmbedPrimary ? (
              <div className="aspect-[16/10] min-h-[320px] bg-black">
                <iframe
                  src={toEmbedUrl(primaryUrl, premiumOutput.type)}
                  title="Experiencia 3D inmersiva"
                  className="h-full w-full border-0"
                  allow="fullscreen; xr-spatial-tracking"
                  loading="lazy"
                />
              </div>
            ) : (
              <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 bg-slate-900 px-5 py-10 text-center">
                <p className="max-w-md text-sm font-semibold text-white/60">Este viewer 3D se abre en una pestaña externa para mantener la entrega segura.</p>
                <a href={primaryUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-violet-500 px-5 py-3 text-sm font-black text-white hover:bg-violet-400">
                  Abrir experiencia 3D <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            )}
          </div>
        ) : primaryUrl ? (
          <a href={primaryUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-ip-card bg-slate-950 px-5 py-4 text-white dark:bg-white dark:text-slate-950">
            <span className="font-black">Abrir experiencia publicada</span>
            <ExternalLink className="h-5 w-5" />
          </a>
        ) : null}

        {job.outputAssets.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {job.outputAssets.filter((asset) => asset.id !== premiumOutput?.id).map((asset) => (
              <a key={asset.id} href={asset.url} target="_blank" rel="noreferrer" className="rounded-ip-card bg-white p-5 ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-lg dark:bg-ip-card dark:ring-ip-card-border">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{asset.type}</p>
                <p className="mt-2 text-lg font-black text-slate-950 dark:text-white">{asset.format || 'url'}</p>
                <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-white/45">
                  {asset.viewerReady ? 'Viewer listo' : 'Viewer pendiente'} · {asset.mobileReady ? 'Movil listo' : 'Movil pendiente'}
                </p>
              </a>
            ))}
          </div>
        ) : (
          <p className="rounded-ip-card bg-white p-6 text-sm font-semibold text-slate-500 ring-1 ring-slate-200 dark:bg-ip-card dark:text-white/45 dark:ring-ip-card-border">
            La entrega esta publicada, pero aun no tiene outputs publicos vinculados.
          </p>
        )}
      </section>
    </main>
  );
}
