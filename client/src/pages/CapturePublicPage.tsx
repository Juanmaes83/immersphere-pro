import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { api, getApiErrorMessage, unwrapApiResponse } from '@/services/api';
import type { PublicCaptureJob } from '@/types/api';

function statusLabel(value: string): string {
  return value.replace(/_/g, ' ');
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
        {job.publicUrl ? (
          <a href={job.publicUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-ip-card bg-slate-950 px-5 py-4 text-white dark:bg-white dark:text-slate-950">
            <span className="font-black">Abrir experiencia publicada</span>
            <ExternalLink className="h-5 w-5" />
          </a>
        ) : null}

        {job.outputAssets.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {job.outputAssets.map((asset) => (
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
