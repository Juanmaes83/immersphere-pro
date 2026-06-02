import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Upload, QrCode, ExternalLink, Archive, RefreshCw, Copy } from 'lucide-react';
import { api, getApiErrorMessage, unwrapApiResponse } from '@/services/api';
import { usePropertyStore } from '@/store/propertyStore';
import type { CaptureJob, CaptureOutputAsset } from '@/types/api';

const STATUSES = [
  'draft',
  'received',
  'assets_review',
  'needs_more_material',
  'ready_for_processing',
  'processing_manual',
  'processing_lab',
  'qa_review',
  'client_review',
  'approved',
  'published',
  'connected_to_crm',
  'archived',
  'failed',
  'cancelled'
];

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const RISK_LEVELS = ['low', 'medium', 'high', 'blocked'];
const OUTPUT_TYPES = [
  'viewer',
  'landing',
  'video',
  'image',
  'pdf',
  'link',
  'gaussian_splat',
  'splat_viewer',
  'supersplat',
  'spark_viewer',
  'external_3d_viewer'
];
const PREMIUM_3D_OUTPUT_TYPES = ['gaussian_splat', 'splat_viewer', 'supersplat', 'spark_viewer', 'external_3d_viewer'];
const PREMIUM_3D_PRIORITY = ['gaussian_splat', 'splat_viewer', 'supersplat', 'spark_viewer', 'external_3d_viewer'];
const EMBEDDABLE_3D_HOSTS = ['superspl.at', 'sparkjs.dev', 'playcanvas.com', 'luma.ai', 'lumalabs.ai', 'immersphere.io', 'immersphere-pro.vercel.app'];

interface CaptureJobForm {
  leadId: string;
  propertyId: string;
  title: string;
  clientName: string;
  projectType: string;
  vertical: string;
  status: string;
  priority: string;
  source: string;
  assignedTo: string;
  dueDate: string;
  estimatedCost: string;
  estimatedHours: string;
  commercialValue: string;
  riskLevel: string;
  nextAction: string;
  notes: string;
  publicUrl: string;
  qrUrl: string;
}

interface OutputForm {
  type: string;
  format: string;
  url: string;
  status: string;
  viewerReady: boolean;
  mobileReady: boolean;
  publishedUrl: string;
  analyticsEnabled: boolean;
  notes: string;
}

const emptyJobForm: CaptureJobForm = {
  leadId: '',
  propertyId: '',
  title: '',
  clientName: '',
  projectType: 'property',
  vertical: 'real_estate',
  status: 'draft',
  priority: 'medium',
  source: 'manual',
  assignedTo: '',
  dueDate: '',
  estimatedCost: '',
  estimatedHours: '',
  commercialValue: '',
  riskLevel: 'low',
  nextAction: '',
  notes: '',
  publicUrl: '',
  qrUrl: ''
};

const emptyOutputForm: OutputForm = {
  type: 'viewer',
  format: 'url',
  url: '',
  status: 'planned',
  viewerReady: false,
  mobileReady: false,
  publishedUrl: '',
  analyticsEnabled: false,
  notes: ''
};

function isPremium3dOutput(type: string): boolean {
  return PREMIUM_3D_OUTPUT_TYPES.includes(type);
}

function getOutputUrl(asset: CaptureOutputAsset): string {
  return asset.publishedUrl || asset.url;
}

function getProviderLabel(assetOrType: CaptureOutputAsset | string, rawUrl = ''): string {
  const type = typeof assetOrType === 'string' ? assetOrType : assetOrType.type;
  const url = typeof assetOrType === 'string' ? rawUrl : getOutputUrl(assetOrType);
  const normalizedUrl = url.toLowerCase();
  if (type === 'supersplat' || normalizedUrl.includes('superspl.at')) return 'SuperSplat';
  if (type === 'spark_viewer' || normalizedUrl.includes('spark')) return 'Spark';
  if (normalizedUrl.includes('luma.ai') || normalizedUrl.includes('lumalabs.ai')) return 'Luma';
  if (type === 'external_3d_viewer') return 'Viewer propio/externo';
  if (type === 'gaussian_splat' || type === 'splat_viewer') return 'Viewer Gaussian/Splat';
  return 'Otro';
}

function canEmbedOutput(asset: CaptureOutputAsset): boolean {
  const url = getOutputUrl(asset);
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return EMBEDDABLE_3D_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}

function getPremium3dPriority(type: string): number {
  const index = PREMIUM_3D_PRIORITY.indexOf(type);
  return index === -1 ? 99 : index;
}

function sortPremium3dOutputs(assets: CaptureOutputAsset[]): CaptureOutputAsset[] {
  return [...assets].sort((a, b) => {
    const priorityDiff = getPremium3dPriority(a.type) - getPremium3dPriority(b.type);
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

function getPrimaryPremium3dOutput(job: Pick<CaptureJob, 'outputAssets'>): CaptureOutputAsset | null {
  const premium = (job.outputAssets ?? []).filter((asset) => isPremium3dOutput(asset.type));
  const published = premium.filter((asset) => asset.status === 'published');
  return sortPremium3dOutputs(published.length > 0 ? published : premium)[0] ?? null;
}

function get3dWarnings(asset: CaptureOutputAsset | null): string[] {
  if (!asset) return ['Sin output 3D premium registrado.'];
  const warnings: string[] = [];
  const url = getOutputUrl(asset);
  if (!url) warnings.push('Falta URL del viewer.');
  if (asset.status === 'published' && !asset.viewerReady) warnings.push('Publicado sin validar desktop.');
  if (asset.status === 'published' && !asset.mobileReady) warnings.push('Publicado sin validar móvil.');
  if (isPremium3dOutput(asset.type) && !url) warnings.push('Revisar fallback externo.');
  return warnings;
}

function getSuggestedFormat(type: string): string {
  if (type === 'gaussian_splat') return 'gaussian';
  if (type === 'supersplat' || type === 'splat_viewer') return 'splat';
  if (type === 'spark_viewer') return 'external_url';
  if (type === 'external_3d_viewer') return 'iframe';
  return 'url';
}

function toJobForm(job: CaptureJob): CaptureJobForm {
  return {
    leadId: job.leadId ?? '',
    propertyId: job.propertyId ?? '',
    title: job.title,
    clientName: job.clientName,
    projectType: job.projectType,
    vertical: job.vertical,
    status: job.status,
    priority: job.priority,
    source: job.source,
    assignedTo: job.assignedTo,
    dueDate: job.dueDate ? job.dueDate.slice(0, 10) : '',
    estimatedCost: job.estimatedCost == null ? '' : String(job.estimatedCost),
    estimatedHours: job.estimatedHours == null ? '' : String(job.estimatedHours),
    commercialValue: job.commercialValue == null ? '' : String(job.commercialValue),
    riskLevel: job.riskLevel,
    nextAction: job.nextAction,
    notes: job.notes,
    publicUrl: job.publicUrl,
    qrUrl: job.qrUrl
  };
}

function toPayload(form: CaptureJobForm): Record<string, unknown> {
  const numberOrNull = (value: string): number | null => {
    if (!value.trim()) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : null;
  };

  return {
    leadId: form.leadId.trim() || null,
    propertyId: form.propertyId.trim() || null,
    title: form.title.trim(),
    clientName: form.clientName.trim(),
    projectType: form.projectType.trim() || 'property',
    vertical: form.vertical.trim() || 'real_estate',
    status: form.status,
    priority: form.priority,
    source: form.source.trim() || 'manual',
    assignedTo: form.assignedTo.trim(),
    dueDate: form.dueDate || null,
    estimatedCost: numberOrNull(form.estimatedCost),
    estimatedHours: numberOrNull(form.estimatedHours),
    commercialValue: numberOrNull(form.commercialValue),
    riskLevel: form.riskLevel,
    nextAction: form.nextAction.trim(),
    notes: form.notes.trim(),
    publicUrl: form.publicUrl.trim(),
    qrUrl: form.qrUrl.trim()
  };
}

function statusLabel(value: string): string {
  return value.replace(/_/g, ' ');
}

function badgeClass(value: string): string {
  if (['published', 'approved', 'connected_to_crm', 'ready'].includes(value)) return 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-800/50';
  if (['failed', 'cancelled', 'blocked'].includes(value)) return 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/30 dark:text-red-300 dark:ring-red-800/50';
  if (['high', 'urgent', 'needs_more_material', 'qa_review', 'client_review'].includes(value)) return 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-800/50';
  return 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-white/5 dark:text-white/60 dark:ring-white/10';
}

function FieldLabel({ children }: { children: React.ReactNode }): JSX.Element {
  return <label className="text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-white/40">{children}</label>;
}

export default function CaptureJobsPage(): JSX.Element {
  const { properties, fetchProperties } = usePropertyStore();
  const [jobs, setJobs] = useState<CaptureJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<CaptureJob | null>(null);
  const [form, setForm] = useState<CaptureJobForm>(emptyJobForm);
  const [outputForm, setOutputForm] = useState<OutputForm>(emptyOutputForm);
  const [filters, setFilters] = useState({ status: '', priority: '', riskLevel: '', q: '' });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchProperties({ limit: 100 });
    void loadJobs();
  }, [fetchProperties]);

  const metrics = useMemo(() => {
    const active = jobs.filter((job) => !['archived', 'cancelled'].includes(job.status));
    return {
      active: active.length,
      blocked: jobs.filter((job) => job.riskLevel === 'blocked' || job.status === 'failed').length,
      review: jobs.filter((job) => ['assets_review', 'qa_review', 'client_review'].includes(job.status)).length,
      published: jobs.filter((job) => job.status === 'published' || job.status === 'connected_to_crm').length
    };
  }, [jobs]);

  async function loadJobs(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value.trim()) params.set(key, value.trim());
      });
      const suffix = params.toString() ? `?${params.toString()}` : '';
      const data = await unwrapApiResponse<CaptureJob[]>(api.get(`/capture-jobs${suffix}`));
      setJobs(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadJob(id: string): Promise<void> {
    setError(null);
    try {
      const data = await unwrapApiResponse<CaptureJob>(api.get(`/capture-jobs/${id}`));
      setSelectedJob(data);
      setForm(toJobForm(data));
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  function resetForNew(): void {
    setSelectedJob(null);
    setForm(emptyJobForm);
    setOutputForm(emptyOutputForm);
    setMessage(null);
    setError(null);
  }

  function updateForm<K extends keyof CaptureJobForm>(key: K, value: CaptureJobForm[K]): void {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateOutputForm<K extends keyof OutputForm>(key: K, value: OutputForm[K]): void {
    setOutputForm((current) => ({ ...current, [key]: value }));
  }

  function updateOutputType(type: string): void {
    setOutputForm((current) => ({
      ...current,
      type,
      format: current.format && current.format !== 'url' ? current.format : getSuggestedFormat(type)
    }));
  }

  async function copyViewerUrl(url: string): Promise<void> {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setMessage('URL viewer copiada.');
    } catch {
      setError('No se pudo copiar la URL.');
    }
  }

  async function saveJob(event: FormEvent): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload = toPayload(form);
      const data = selectedJob
        ? await unwrapApiResponse<CaptureJob>(api.put(`/capture-jobs/${selectedJob.id}`, payload))
        : await unwrapApiResponse<CaptureJob>(api.post('/capture-jobs', payload));
      setSelectedJob(data);
      setForm(toJobForm(data));
      setMessage(selectedJob ? 'CaptureJob actualizado.' : 'CaptureJob creado.');
      await loadJobs();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function archiveJob(): Promise<void> {
    if (!selectedJob) return;
    setSaving(true);
    setError(null);
    try {
      await unwrapApiResponse<CaptureJob>(api.delete(`/capture-jobs/${selectedJob.id}`));
      setMessage('CaptureJob archivado.');
      await loadJobs();
      await loadJob(selectedJob.id);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function generateQr(): Promise<void> {
    if (!selectedJob) return;
    setSaving(true);
    setError(null);
    try {
      const data = await unwrapApiResponse<CaptureJob>(api.post(`/capture-jobs/${selectedJob.id}/qr`));
      setSelectedJob(data);
      setForm((current) => ({ ...current, qrUrl: data.qrUrl }));
      setMessage('QR generado desde publicUrl.');
      await loadJobs();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function uploadInputAsset(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !selectedJob) return;
    setUploading(true);
    setError(null);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', file.type.startsWith('video/') ? 'video' : file.type === 'application/pdf' ? 'document' : 'image');
      formData.append('source', 'upload');
      await unwrapApiResponse(api.post(`/capture-jobs/${selectedJob.id}/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }));
      setMessage('Input asset subido y registrado.');
      await loadJob(selectedJob.id);
      await loadJobs();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  async function addOutputAsset(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!selectedJob) return;
    setSaving(true);
    setError(null);
    try {
      await unwrapApiResponse<CaptureOutputAsset>(api.post(`/capture-jobs/${selectedJob.id}/output-assets`, outputForm));
      setOutputForm(emptyOutputForm);
      setMessage('Output asset registrado.');
      await loadJob(selectedJob.id);
      await loadJobs();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-10">
      <Helmet>
        <title>Capture Jobs · Immersphere Pro</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-ip-accent">Operacion visual</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950 dark:text-white">Capture Jobs</h1>
          <p className="mt-2 max-w-2xl text-sm font-semibold text-slate-500 dark:text-white/45">
            Gestiona material recibido, QA, outputs, URL publica y conexion basica con propiedades o leads.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => { void loadJobs(); }} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-white/70 dark:hover:bg-white/5">
            <RefreshCw className="h-4 w-4" /> Actualizar
          </button>
          <button type="button" onClick={resetForNew} className="rounded-full bg-ip-accent px-5 py-2 text-sm font-black text-white hover:bg-ip-accent-hover">
            Nuevo CaptureJob
          </button>
        </div>
      </div>

      <section className="mt-6 grid gap-3 sm:grid-cols-4">
        {[
          ['Activos', metrics.active],
          ['En revision', metrics.review],
          ['Bloqueados', metrics.blocked],
          ['Publicados', metrics.published]
        ].map(([label, value]) => (
          <div key={label} className="rounded-ip-card bg-white p-4 ring-1 ring-slate-200 dark:bg-ip-card dark:ring-ip-card-border">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
            <p className="mt-2 text-3xl font-black text-slate-950 dark:text-white">{value}</p>
          </div>
        ))}
      </section>

      <section className="mt-6 rounded-ip-card bg-white p-4 ring-1 ring-slate-200 dark:bg-ip-card dark:ring-ip-card-border">
        <div className="grid gap-3 md:grid-cols-5">
          <div>
            <input value={filters.q} onChange={(e) => setFilters((current) => ({ ...current, q: e.target.value }))} placeholder="Buscar" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-white/5" />
            <p className="mt-1 text-[11px] font-bold leading-4 text-slate-400 dark:text-white/35">
              Puedes buscar por cliente, proyecto, ID, URL pública, QR u output 3D.
            </p>
          </div>
          <select value={filters.status} onChange={(e) => setFilters((current) => ({ ...current, status: e.target.value }))} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-white/5">
            <option value="">Todos los estados</option>
            {STATUSES.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
          </select>
          <select value={filters.priority} onChange={(e) => setFilters((current) => ({ ...current, priority: e.target.value }))} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-white/5">
            <option value="">Todas las prioridades</option>
            {PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
          </select>
          <select value={filters.riskLevel} onChange={(e) => setFilters((current) => ({ ...current, riskLevel: e.target.value }))} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-white/5">
            <option value="">Todos los riesgos</option>
            {RISK_LEVELS.map((risk) => <option key={risk} value={risk}>{risk}</option>)}
          </select>
          <button type="button" onClick={() => { void loadJobs(); }} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white dark:bg-white dark:text-slate-950">
            Filtrar
          </button>
        </div>
      </section>

      {error ? <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p> : null}
      {message ? <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">{message}</p> : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="overflow-hidden rounded-ip-card bg-white ring-1 ring-slate-200 dark:bg-ip-card dark:ring-ip-card-border">
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full text-left text-sm">
              <thead className="border-b border-slate-100 text-xs uppercase tracking-[0.12em] text-slate-400 dark:border-white/10">
                <tr>
                  <th className="px-4 py-3">Trabajo</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Prioridad</th>
                  <th className="px-4 py-3">Riesgo</th>
                  <th className="px-4 py-3">Proxima accion</th>
                  <th className="px-4 py-3">Assets</th>
                  <th className="px-4 py-3">3D</th>
                  <th className="px-4 py-3">Publico</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                {loading ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center font-bold text-slate-400">Cargando CaptureJobs...</td></tr>
                ) : jobs.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center font-bold text-slate-400">No hay CaptureJobs todavia.</td></tr>
                ) : jobs.map((job) => (
                  <tr key={job.id} className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 ${selectedJob?.id === job.id ? 'bg-violet-50/70 dark:bg-violet-950/20' : ''}`} onClick={() => { void loadJob(job.id); }}>
                    <td className="px-4 py-3">
                      <p className="font-black text-slate-950 dark:text-white">{job.title}</p>
                      <p className="text-xs font-semibold text-slate-500 dark:text-white/40">{job.clientName} · {job.projectType}</p>
                      {job.property ? <p className="mt-1 text-xs font-bold text-ip-accent">{job.property.title}</p> : null}
                    </td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-black ring-1 ${badgeClass(job.status)}`}>{statusLabel(job.status)}</span></td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-black ring-1 ${badgeClass(job.priority)}`}>{job.priority}</span></td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-black ring-1 ${badgeClass(job.riskLevel)}`}>{job.riskLevel}</span></td>
                    <td className="max-w-[240px] px-4 py-3 text-xs font-semibold text-slate-500 dark:text-white/50">{job.nextAction || '-'}</td>
                    <td className="px-4 py-3 text-xs font-black text-slate-600 dark:text-white/60">{job._count?.inputAssets ?? job.inputAssets?.length ?? 0} in · {job._count?.outputAssets ?? job.outputAssets?.length ?? 0} out</td>
                    <td className="px-4 py-3">
                      {(() => {
                        const primary3d = getPrimaryPremium3dOutput(job);
                        if (!primary3d) return <span className="text-xs font-bold text-slate-400">-</span>;
                        const threeDReady = primary3d.status === 'published' && primary3d.viewerReady && primary3d.mobileReady && Boolean(getOutputUrl(primary3d));
                        return (
                          <div className="space-y-1">
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] ring-1 ${threeDReady ? badgeClass('published') : badgeClass('qa_review')}`}>
                              {threeDReady ? '3D listo' : '3D pendiente'}
                            </span>
                            <p className="text-[10px] font-bold text-slate-400">{getProviderLabel(primary3d)}</p>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">{job.publicUrl ? <a href={job.publicUrl} onClick={(e) => e.stopPropagation()} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-black text-ip-accent"><ExternalLink className="h-3 w-3" /> URL</a> : <span className="text-xs font-bold text-slate-400">-</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="rounded-ip-card bg-white p-5 ring-1 ring-slate-200 dark:bg-ip-card dark:ring-ip-card-border">
          <form onSubmit={(event) => { void saveJob(event); }} className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{selectedJob ? 'Editar' : 'Crear'}</p>
                <h2 className="text-xl font-black text-slate-950 dark:text-white">CaptureJob</h2>
              </div>
              {selectedJob ? (
                <button type="button" onClick={() => { void archiveJob(); }} disabled={saving} className="inline-flex items-center gap-2 rounded-full border border-red-200 px-3 py-2 text-xs font-black text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:text-red-300 dark:hover:bg-red-950/20">
                  <Archive className="h-3.5 w-3.5" /> Archivar
                </button>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <FieldLabel>Titulo</FieldLabel>
                <input required value={form.title} onChange={(e) => updateForm('title', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-white/5" />
              </div>
              <div>
                <FieldLabel>Cliente</FieldLabel>
                <input required value={form.clientName} onChange={(e) => updateForm('clientName', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-white/5" />
              </div>
              <div>
                <FieldLabel>Propiedad</FieldLabel>
                <select value={form.propertyId} onChange={(e) => updateForm('propertyId', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-white/5">
                  <option value="">Sin propiedad</option>
                  {properties.map((property) => <option key={property.id} value={property.id}>{property.title}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel>Lead ID</FieldLabel>
                <input value={form.leadId} onChange={(e) => updateForm('leadId', e.target.value)} placeholder="Opcional" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-white/5" />
              </div>
              <div>
                <FieldLabel>Tipo</FieldLabel>
                <input value={form.projectType} onChange={(e) => updateForm('projectType', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-white/5" />
              </div>
              <div>
                <FieldLabel>Vertical</FieldLabel>
                <input value={form.vertical} onChange={(e) => updateForm('vertical', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-white/5" />
              </div>
              <div>
                <FieldLabel>Estado</FieldLabel>
                <select value={form.status} onChange={(e) => updateForm('status', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-white/5">
                  {STATUSES.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel>Prioridad</FieldLabel>
                <select value={form.priority} onChange={(e) => updateForm('priority', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-white/5">
                  {PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel>Riesgo</FieldLabel>
                <select value={form.riskLevel} onChange={(e) => updateForm('riskLevel', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-white/5">
                  {RISK_LEVELS.map((risk) => <option key={risk} value={risk}>{risk}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel>Fecha objetivo</FieldLabel>
                <input type="date" value={form.dueDate} onChange={(e) => updateForm('dueDate', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-white/5" />
              </div>
              <div>
                <FieldLabel>Horas</FieldLabel>
                <input inputMode="numeric" value={form.estimatedHours} onChange={(e) => updateForm('estimatedHours', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-white/5" />
              </div>
              <div>
                <FieldLabel>Valor comercial</FieldLabel>
                <input inputMode="numeric" value={form.commercialValue} onChange={(e) => updateForm('commercialValue', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-white/5" />
              </div>
              <div>
                <FieldLabel>Coste estimado</FieldLabel>
                <input inputMode="numeric" value={form.estimatedCost} onChange={(e) => updateForm('estimatedCost', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-white/5" />
              </div>
              <div>
                <FieldLabel>Responsable</FieldLabel>
                <input value={form.assignedTo} onChange={(e) => updateForm('assignedTo', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-white/5" />
              </div>
              <div className="sm:col-span-2">
                <FieldLabel>Proxima accion</FieldLabel>
                <input value={form.nextAction} onChange={(e) => updateForm('nextAction', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-white/5" />
              </div>
              <div className="sm:col-span-2">
                <FieldLabel>Public URL</FieldLabel>
                <input value={form.publicUrl} onChange={(e) => updateForm('publicUrl', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-white/5" />
              </div>
              <div className="sm:col-span-2">
                <FieldLabel>Notas internas</FieldLabel>
                <textarea value={form.notes} onChange={(e) => updateForm('notes', e.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-white/5" />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={saving} className="rounded-full bg-ip-accent px-5 py-2 text-sm font-black text-white hover:bg-ip-accent-hover disabled:opacity-60">
                {saving ? 'Guardando...' : selectedJob ? 'Guardar cambios' : 'Crear CaptureJob'}
              </button>
              {selectedJob ? (
                <button type="button" onClick={() => { void generateQr(); }} disabled={saving || !form.publicUrl.trim()} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-white/70 dark:hover:bg-white/5">
                  <QrCode className="h-4 w-4" /> Generar QR
                </button>
              ) : null}
            </div>
          </form>

          {selectedJob ? (
            <div className="mt-6 space-y-5 border-t border-slate-100 pt-5 dark:border-white/10">
              {(() => {
                const primary3d = getPrimaryPremium3dOutput(selectedJob);
                const warnings = get3dWarnings(primary3d);
                return (
                  <div className="rounded-xl border border-violet-200 bg-violet-50/70 p-4 dark:border-violet-900/50 dark:bg-violet-950/20">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700 dark:text-violet-300">Pipeline manual 3D</p>
                        <h3 className="mt-1 text-base font-black text-slate-950 dark:text-white">
                          {primary3d ? 'Output 3D principal automático' : 'Sin output 3D principal'}
                        </h3>
                      </div>
                      {primary3d ? (
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] ring-1 ${primary3d.status === 'published' && primary3d.viewerReady && primary3d.mobileReady ? badgeClass('published') : badgeClass('qa_review')}`}>
                          {primary3d.status === 'published' && primary3d.viewerReady && primary3d.mobileReady ? '3D listo' : 'QA pendiente'}
                        </span>
                      ) : null}
                    </div>

                    {primary3d ? (
                      <>
                        <div className="mt-3 grid gap-2 text-xs font-bold text-slate-600 dark:text-white/60 sm:grid-cols-2">
                          <p>Provider: <span className="font-black text-slate-900 dark:text-white">{getProviderLabel(primary3d)}</span></p>
                          <p>Tipo: <span className="font-black text-slate-900 dark:text-white">{statusLabel(primary3d.type)}</span></p>
                          <p>Fallback externo: <span className="font-black text-slate-900 dark:text-white">{getOutputUrl(primary3d) ? 'OK' : 'Pendiente'}</span></p>
                          <p>Iframe: <span className="font-black text-slate-900 dark:text-white">{canEmbedOutput(primary3d) ? 'Embebible' : 'Usar fallback externo'}</span></p>
                        </div>
                        <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-500 dark:bg-slate-950 dark:text-white/50">
                          Este será el output 3D principal según prioridad automática. No se modifica ni archiva ningún otro output.
                        </p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {[
                            ['URL válida', Boolean(getOutputUrl(primary3d))],
                            ['Provider definido', Boolean(getProviderLabel(primary3d))],
                            ['Desktop probado', primary3d.viewerReady],
                            ['Móvil probado', primary3d.mobileReady],
                            ['Iframe o fallback confirmado', canEmbedOutput(primary3d) || Boolean(getOutputUrl(primary3d))],
                            ['Status published', primary3d.status === 'published'],
                          ].map(([label, ok]) => (
                            <div key={String(label)} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-xs font-bold dark:bg-slate-950">
                              <span className="text-slate-500 dark:text-white/50">{label}</span>
                              <span className={ok ? 'text-emerald-600 dark:text-emerald-300' : 'text-amber-600 dark:text-amber-300'}>{ok ? 'OK' : 'Pendiente'}</span>
                            </div>
                          ))}
                        </div>
                        {warnings.length > 0 ? (
                          <div className="mt-3 space-y-1">
                            {warnings.map((warning) => (
                              <p key={warning} className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">{warning}</p>
                            ))}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <p className="mt-3 text-xs font-bold text-slate-500 dark:text-white/50">
                        Registra un output `supersplat`, `gaussian_splat`, `splat_viewer`, `spark_viewer` o `external_3d_viewer` para activar la entrega 3D manual.
                      </p>
                    )}
                  </div>
                );
              })()}

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-[0.14em] text-slate-500 dark:text-white/40">Input assets</h3>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-white/70 dark:hover:bg-white/5">
                    <Upload className="h-3.5 w-3.5" /> {uploading ? 'Subiendo...' : 'Subir'}
                    <input type="file" className="hidden" accept=".jpg,.jpeg,.png,.webp,.mp4,.mov,.pdf" onChange={(event) => { void uploadInputAsset(event); }} disabled={uploading} />
                  </label>
                </div>
                <div className="space-y-2">
                  {(selectedJob.inputAssets ?? []).length === 0 ? <p className="text-sm font-semibold text-slate-400">Sin material registrado.</p> : selectedJob.inputAssets?.map((asset) => (
                    <a key={asset.id} href={asset.url} target="_blank" rel="noreferrer" className="block rounded-xl border border-slate-100 px-3 py-2 text-sm hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5">
                      <span className="font-black text-slate-800 dark:text-white">{asset.filename || asset.type}</span>
                      <span className="ml-2 text-xs font-bold text-slate-400">{asset.status} · {asset.format || asset.type}</span>
                    </a>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-black uppercase tracking-[0.14em] text-slate-500 dark:text-white/40">Output assets</h3>
                <form onSubmit={(event) => { void addOutputAsset(event); }} className="space-y-3 rounded-xl bg-slate-50 p-3 dark:bg-white/5">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <select value={outputForm.type} onChange={(e) => updateOutputType(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-slate-900">
                      {OUTPUT_TYPES.map((type) => <option key={type} value={type}>{statusLabel(type)}</option>)}
                    </select>
                    <select value={outputForm.status} onChange={(e) => updateOutputForm('status', e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-slate-900">
                      {['planned', 'in_progress', 'ready', 'in_review', 'approved', 'published', 'archived'].map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
                    </select>
                    <select value={outputForm.format} onChange={(e) => updateOutputForm('format', e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-slate-900">
                      {['url', 'external_url', 'iframe', 'splat', 'gaussian', 'video', 'pdf', 'image'].map((format) => <option key={format} value={format}>{statusLabel(format)}</option>)}
                    </select>
                    <input value={outputForm.url} onChange={(e) => updateOutputForm('url', e.target.value)} placeholder={isPremium3dOutput(outputForm.type) ? 'URL viewer 3D externa' : 'URL interna/externa'} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-slate-900" />
                    <input value={outputForm.publishedUrl} onChange={(e) => updateOutputForm('publishedUrl', e.target.value)} placeholder="URL publicada o embebible" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-slate-900 sm:col-span-2" />
                  </div>
                  {isPremium3dOutput(outputForm.type) ? (
                    <div className="space-y-2 rounded-lg bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 dark:bg-violet-950/25 dark:text-violet-300">
                      <p>Output premium 3D manual: registra una URL externa segura de SuperSplat, Spark, Luma o viewer propio. No subas .ply, .spz, .splat, .sog, html ni zip.</p>
                      <p>Provider derivado: <span className="font-black">{getProviderLabel(outputForm.type, outputForm.publishedUrl || outputForm.url)}</span></p>
                      <p>Si se publica, este output podrá actuar como principal según prioridad automática.</p>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-3 text-xs font-bold text-slate-500 dark:text-white/50">
                    <label className="inline-flex items-center gap-2"><input type="checkbox" checked={outputForm.viewerReady} onChange={(e) => updateOutputForm('viewerReady', e.target.checked)} /> Desktop OK</label>
                    <label className="inline-flex items-center gap-2"><input type="checkbox" checked={outputForm.mobileReady} onChange={(e) => updateOutputForm('mobileReady', e.target.checked)} /> Mobile OK</label>
                    <label className="inline-flex items-center gap-2"><input type="checkbox" checked={outputForm.analyticsEnabled} onChange={(e) => updateOutputForm('analyticsEnabled', e.target.checked)} /> Analytics</label>
                  </div>
                  <textarea
                    value={outputForm.notes}
                    onChange={(e) => updateOutputForm('notes', e.target.value)}
                    rows={2}
                    placeholder={isPremium3dOutput(outputForm.type) ? 'Observaciones QA internas: iframe, fallback, rendimiento, dispositivo móvil probado...' : 'Notas internas del output'}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-slate-900"
                  />
                  {isPremium3dOutput(outputForm.type) && outputForm.status === 'published' ? (
                    <div className="space-y-1">
                      {!outputForm.viewerReady ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">Publicado sin validar desktop.</p> : null}
                      {!outputForm.mobileReady ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">Publicado sin validar móvil.</p> : null}
                      {!(outputForm.publishedUrl || outputForm.url).trim() ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">Falta URL del viewer o fallback externo.</p> : null}
                    </div>
                  ) : null}
                  <button type="submit" disabled={saving || !outputForm.url.trim()} className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white disabled:opacity-50 dark:bg-white dark:text-slate-950">Registrar output</button>
                </form>
                <div className="mt-3 space-y-2">
                  {(selectedJob.outputAssets ?? []).length === 0 ? <p className="text-sm font-semibold text-slate-400">Sin entregables registrados.</p> : selectedJob.outputAssets?.map((asset) => (
                    <div key={asset.id} className={`rounded-xl border px-3 py-2 text-sm ${isPremium3dOutput(asset.type) ? 'border-violet-200 bg-violet-50/70 dark:border-violet-900/50 dark:bg-violet-950/20' : 'border-slate-100 dark:border-white/10'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-black text-slate-800 dark:text-white">{statusLabel(asset.type)}</p>
                          <p className="text-xs font-bold text-slate-400">{asset.status} · {asset.format || 'url'} · {asset.viewerReady ? 'Desktop OK' : 'Desktop pendiente'} · {asset.mobileReady ? 'Mobile OK' : 'Mobile pendiente'}</p>
                          {isPremium3dOutput(asset.type) ? (
                            <div className="mt-2 space-y-2">
                              <div className="flex flex-wrap gap-1.5">
                                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-violet-700 ring-1 ring-violet-200 dark:bg-slate-950 dark:text-violet-300 dark:ring-violet-900/50">
                                  {getProviderLabel(asset)}
                                </span>
                                {getPrimaryPremium3dOutput(selectedJob)?.id === asset.id ? (
                                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-800/50">
                                    Principal automático
                                  </span>
                                ) : null}
                                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-slate-600 ring-1 ring-slate-200 dark:bg-slate-950 dark:text-white/60 dark:ring-white/10">
                                  {canEmbedOutput(asset) ? 'Iframe viable' : 'Fallback externo'}
                                </span>
                              </div>
                              <div className="grid gap-1 sm:grid-cols-2">
                                {[
                                  ['URL', Boolean(getOutputUrl(asset))],
                                  ['Desktop', asset.viewerReady],
                                  ['Móvil', asset.mobileReady],
                                  ['Fallback', Boolean(getOutputUrl(asset))],
                                ].map(([label, ok]) => (
                                  <p key={String(label)} className="flex items-center justify-between rounded-lg bg-white px-2 py-1 text-[10px] font-bold dark:bg-slate-950">
                                    <span className="text-slate-500 dark:text-white/50">{label}</span>
                                    <span className={ok ? 'text-emerald-600 dark:text-emerald-300' : 'text-amber-600 dark:text-amber-300'}>{ok ? 'OK' : 'Pendiente'}</span>
                                  </p>
                                ))}
                              </div>
                              {get3dWarnings(asset).map((warning) => (
                                <p key={warning} className="rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">{warning}</p>
                              ))}
                              {asset.notes ? (
                                <p className="rounded-lg bg-white px-2 py-1 text-[10px] font-semibold leading-relaxed text-slate-500 dark:bg-slate-950 dark:text-white/50">
                                  QA interno: {asset.notes}
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <a href={getOutputUrl(asset)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-[10px] font-black text-slate-600 hover:bg-white dark:border-white/10 dark:text-white/70 dark:hover:bg-white/5">
                            <ExternalLink className="h-3 w-3" /> Abrir viewer
                          </a>
                          <button type="button" onClick={() => { void copyViewerUrl(getOutputUrl(asset)); }} className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-[10px] font-black text-slate-600 hover:bg-white dark:border-white/10 dark:text-white/70 dark:hover:bg-white/5">
                            <Copy className="h-3 w-3" /> Copiar URL
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedJob.qrUrl ? (
                <div className="rounded-xl border border-slate-100 p-3 dark:border-white/10">
                  <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400">QR</p>
                  <img src={selectedJob.qrUrl} alt="QR CaptureJob" className="h-32 w-32 rounded-lg bg-white p-2" />
                </div>
              ) : null}

              {selectedJob.status === 'published' ? (
                <Link to={`/capture/${selectedJob.id}`} className="inline-flex items-center gap-2 text-sm font-black text-ip-accent">
                  Ver landing publica interna <ExternalLink className="h-4 w-4" />
                </Link>
              ) : null}
            </div>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
