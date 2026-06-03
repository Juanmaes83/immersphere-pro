import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Upload, QrCode, ExternalLink, Archive, RefreshCw, Copy, BrainCircuit } from 'lucide-react';
import { api, getApiErrorMessage, unwrapApiResponse } from '@/services/api';
import { usePropertyStore } from '@/store/propertyStore';
import type { CaptureAiProcessingResult, CaptureAiProcessingRun, CaptureCommercialBrief, CaptureHotspot, CaptureJob, CaptureOutputAsset } from '@/types/api';

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
const CAPTURE_GUIDE_TYPES = ['3d', 'tour_360', 'video', 'photos', 'document', 'general'] as const;

type CaptureGuideType = (typeof CAPTURE_GUIDE_TYPES)[number];

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

type CommercialBriefForm = CaptureCommercialBrief;

interface HotspotForm {
  label: string;
  description: string;
  roomOrZone: string;
  hotspotType: CaptureHotspot['hotspotType'];
  priority: CaptureHotspot['priority'];
  cta: string;
  mediaSuggestion: string;
  businessObjective: string;
  sortOrder: string;
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

const emptyCommercialBriefForm: CommercialBriefForm = {
  propertyType: '',
  location: '',
  surface: '',
  rooms: '',
  bathrooms: '',
  priceRange: '',
  targetAudience: '',
  salesObjective: '',
  keyBenefits: [],
  differentiators: [],
  tone: 'professional',
  ctaGoal: 'contact',
  brandNotes: '',
  constraints: ''
};

const emptyHotspotForm: HotspotForm = {
  label: '',
  description: '',
  roomOrZone: '',
  hotspotType: 'info',
  priority: 'medium',
  cta: '',
  mediaSuggestion: '',
  businessObjective: '',
  sortOrder: '0'
};

function isPremium3dOutput(type: string): boolean {
  return PREMIUM_3D_OUTPUT_TYPES.includes(type);
}

function getOutputUrl(asset: CaptureOutputAsset): string {
  return asset.publishedUrl || asset.url;
}

function isPublicCaptureStatus(status: string): boolean {
  return status === 'published' || status === 'connected_to_crm';
}

function getCaptureLandingPath(captureJobId: string): string {
  return `/capture/${captureJobId}`;
}

function getCaptureLandingUrl(captureJobId: string): string {
  if (typeof window === 'undefined') return getCaptureLandingPath(captureJobId);
  return `${window.location.origin}${getCaptureLandingPath(captureJobId)}`;
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

function getCaptureGuideLabel(type: CaptureGuideType): string {
  const labels: Record<CaptureGuideType, string> = {
    '3d': '3D / Gaussian / Splat',
    tour_360: 'Tour 360',
    video: 'Vídeo comercial',
    photos: 'Fotos inmobiliarias / showroom',
    document: 'Plano / documento',
    general: 'General'
  };
  return labels[type];
}

function inferCaptureGuideType(job: CaptureJob): CaptureGuideType {
  const haystack = [
    job.projectType,
    job.vertical,
    job.nextAction,
    ...(job.inputAssets ?? []).flatMap((asset) => [asset.type, asset.format, asset.filename]),
    ...(job.outputAssets ?? []).flatMap((asset) => [asset.type, asset.format])
  ].join(' ').toLowerCase();

  if ((job.outputAssets ?? []).some((asset) => isPremium3dOutput(asset.type))) return '3d';
  if (/(gaussian|splat|3d|viewer|supersplat|spark)/.test(haystack)) return '3d';
  if (/(360|panorama|tour|virtual)/.test(haystack)) return 'tour_360';
  if (/(video|mp4|mov|reel|comercial)/.test(haystack)) return 'video';
  if (/(foto|photo|image|jpg|jpeg|png|webp|showroom)/.test(haystack)) return 'photos';
  if (/(pdf|plano|document|documento|floor)/.test(haystack)) return 'document';
  return 'general';
}

function getCaptureChecklist(type: CaptureGuideType): string[] {
  const checklists: Record<CaptureGuideType, string[]> = {
    '3d': [
      'Recorrido completo del espacio.',
      'Iluminación estable.',
      'Sin movimientos bruscos.',
      'Sin personas cruzando si no son necesarias.',
      'Captura de todas las estancias principales.',
      'Zonas de transición incluidas.',
      'Exterior/fachada si aplica.',
      'Prueba de rendimiento móvil pendiente/realizada.',
      'Viewer externo previsto.'
    ],
    tour_360: [
      'Panoramas por estancia.',
      'Puntos de navegación definidos.',
      'Entrada/salida o inicio claro.',
      'Estancias nombradas.',
      'Calidad de imagen suficiente.',
      'Sin stitching roto evidente.',
      'Orientación inicial revisada.'
    ],
    video: [
      'Plano de apertura.',
      'Recorrido principal.',
      'Detalles diferenciales.',
      'Plano final/CTA.',
      'Formato horizontal si es web.',
      'Formato vertical si es redes.',
      'Duración objetivo definida.'
    ],
    photos: [
      'Fachada/entrada.',
      'Espacio principal.',
      'Detalles diferenciales.',
      'Iluminación homogénea.',
      'Fotos horizontales.',
      'Fotos verticales si redes.',
      'Sin elementos no deseados.'
    ],
    document: [
      'Archivo legible.',
      'Formato PDF/imagen.',
      'Escala o orientación clara.',
      'Nombre de zonas si aplica.'
    ],
    general: [
      'Material base recibido.',
      'Objetivo de entrega definido.',
      'Calidad mínima revisada.',
      'Faltantes anotados en próxima acción.',
      'Output previsto antes de publicar.'
    ]
  };
  return checklists[type];
}

function getCaptureGuideText(type: CaptureGuideType): string {
  const texts: Record<CaptureGuideType, string> = {
    '3d': 'Captura recorridos continuos, con luz estable y cubriendo todas las zonas. Evita movimientos bruscos, cambios fuertes de exposición y espacios incompletos. Valida el resultado en desktop y móvil antes de publicar.',
    tour_360: 'Captura un punto por estancia principal y añade puntos de transición. Revisa orientación inicial, continuidad y calidad de imagen.',
    video: 'Graba apertura, recorrido, detalles y cierre. Define si el destino será web horizontal o redes vertical.',
    photos: 'Prioriza luz, orden, amplitud y detalles diferenciales. Evita objetos personales o elementos que resten valor.',
    document: 'Asegura que el archivo sea legible, tenga orientación clara y permita identificar zonas, escala o referencias importantes.',
    general: 'Reúne material suficiente para entender el espacio, define el entregable esperado y deja anotado cualquier faltante antes de producir.'
  };
  return texts[type];
}

function getMaterialState(job: CaptureJob): { label: string; tone: 'danger' | 'warning' | 'success'; detail: string } {
  const inputCount = job.inputAssets?.length ?? 0;
  const hasOutputInProgress = (job.outputAssets ?? []).some((asset) => ['ready', 'approved', 'published'].includes(asset.status));
  if (inputCount === 0) {
    return { label: 'Material incompleto', tone: 'danger', detail: 'No hay material de entrada registrado.' };
  }
  if (!hasOutputInProgress) {
    return { label: 'Material pendiente de revisar', tone: 'warning', detail: 'Hay material, pero aún no hay output generado.' };
  }
  return { label: 'Material suficiente', tone: 'success', detail: 'Hay material base y al menos un output listo o publicado.' };
}

function getCaptureGuideWarnings(job: CaptureJob, type: CaptureGuideType, primary3d: CaptureOutputAsset | null): string[] {
  const warnings: string[] = [];
  const inputCount = job.inputAssets?.length ?? 0;
  const hasAnyOutput = (job.outputAssets ?? []).length > 0;
  const hasPublishedOutput = (job.outputAssets ?? []).some((asset) => asset.status === 'published');
  if (inputCount === 0) warnings.push('No hay material de entrada registrado.');
  if (inputCount > 0 && !hasAnyOutput) warnings.push('Hay material, pero aún no hay output generado.');
  if (hasPublishedOutput) warnings.push('El CaptureJob tiene output publicado, revisa QA antes de compartir.');
  if (type === '3d' && primary3d && !primary3d.mobileReady) warnings.push('Para 3D/Gaussian, valida móvil antes de marcar entrega como lista.');
  if (type === 'tour_360') warnings.push('Para tour 360, revisa navegación y puntos de transición.');
  if (type === 'video') warnings.push('Para vídeo, define formato vertical/horizontal antes de producir.');
  return warnings;
}

function summarizeInputAssets(job: CaptureJob): string[] {
  const counts = new Map<string, number>();
  (job.inputAssets ?? []).forEach((asset) => {
    const key = statusLabel(asset.format || asset.type || 'asset');
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return [...counts.entries()].map(([label, count]) => `${count} ${label}`);
}

function formatRunDate(value: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(value));
}

function stringifyAiSection(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function listToText(value: string[]): string {
  return value.join('\n');
}

function textToList(value: string): string[] {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toCommercialBriefForm(job: CaptureJob | null): CommercialBriefForm {
  return {
    ...emptyCommercialBriefForm,
    ...(job?.commercialBrief ?? {}),
    keyBenefits: job?.commercialBrief?.keyBenefits ?? [],
    differentiators: job?.commercialBrief?.differentiators ?? []
  };
}

function getCommercialBriefCompleteness(brief: CommercialBriefForm): number {
  let score = 0;
  if (brief.propertyType.trim()) score += 10;
  if (brief.location.trim()) score += 10;
  if (brief.targetAudience.trim()) score += 15;
  if (brief.salesObjective.trim()) score += 15;
  if (brief.keyBenefits.length >= 2) score += 15;
  if (brief.differentiators.length >= 1) score += 15;
  if (brief.ctaGoal) score += 10;
  if (brief.tone) score += 10;
  return Math.min(100, score);
}

function hasTextContent(values: Array<string | string[]>): boolean {
  return values.some((value) => Array.isArray(value)
    ? value.some((item) => item.trim().length > 0)
    : value.trim().length > 0);
}

function hasCommercialCopyContent(result: CaptureAiProcessingResult): boolean {
  return hasTextContent([
    result.commercialCopy.shortDescription,
    result.commercialCopy.longDescription,
    result.commercialCopy.propertyHighlights,
    result.commercialCopy.salesAngle,
    result.commercialCopy.targetAudience,
    result.commercialCopy.ctaSuggestions
  ]);
}

function hasVideoScriptContent(result: CaptureAiProcessingResult): boolean {
  return hasTextContent([
    result.videoScript.hook,
    result.videoScript.voiceover,
    result.videoScript.closingCTA,
    result.videoScript.formatRecommendations.horizontal,
    result.videoScript.formatRecommendations.vertical,
    result.videoScript.sceneList.flatMap((scene) => [scene.scene, scene.visual, scene.voiceover, scene.duration])
  ]);
}

function isStaleRunningRun(run: CaptureAiProcessingRun | null): boolean {
  if (!run || run.status !== 'running') return false;
  return Date.now() - new Date(run.createdAt).getTime() > 15 * 60 * 1000;
}

function isClientTimeout(error: unknown): boolean {
  return error instanceof Error && error.message.toLowerCase().includes('timeout');
}

function getAiRunErrorMessage(error: string): string {
  const normalized = error.toLowerCase();
  if (normalized.includes('tool_use_missing')) {
    return 'La IA no devolvió la herramienta esperada. Reintenta el procesamiento.';
  }
  if (normalized.includes('tool_input_schema_invalid') || normalized.includes('zod_validation_failed')) {
    return 'La respuesta IA no pasó la validación de estructura. Reintenta el procesamiento.';
  }
  if (normalized.includes('json_parse_failed')) {
    return 'La IA respondió con JSON inválido. Reintenta el procesamiento.';
  }
  if (normalized.includes('model_not_available')) {
    return 'El modelo configurado no está disponible. Revisa la configuración IA.';
  }
  if (normalized.includes('anthropic_api_error')) {
    return 'Error de proveedor IA. Reintenta más tarde.';
  }
  if (normalized.includes('json parse failed') || normalized.includes('json schema failed') || normalized.includes('tool')) {
    return 'La IA respondió con formato inválido. Reintenta el procesamiento.';
  }
  return error;
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
  const [commercialBriefForm, setCommercialBriefForm] = useState<CommercialBriefForm>(emptyCommercialBriefForm);
  const [hotspotForm, setHotspotForm] = useState<HotspotForm>(emptyHotspotForm);
  const [editingHotspotId, setEditingHotspotId] = useState<string | null>(null);
  const [filters, setFilters] = useState({ status: '', priority: '', riskLevel: '', q: '' });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guideTypeOverride, setGuideTypeOverride] = useState<CaptureGuideType | ''>('');
  const [aiRuns, setAiRuns] = useState<CaptureAiProcessingRun[]>([]);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiRunsOpen, setAiRunsOpen] = useState(false);

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

  const latestAiRun = aiRuns[0] ?? null;
  const hasRunningAiRun = aiRuns.some((run) => run.status === 'running');
  const hasStaleRunningAiRun = isStaleRunningRun(latestAiRun);
  const commercialBriefCompleteness = selectedJob?.commercialBriefCompleteness ?? getCommercialBriefCompleteness(commercialBriefForm);
  const contextLimited = (selectedJob?.inputAssets?.length ?? 0) === 0 || commercialBriefCompleteness < 40 || (latestAiRun?.result?.confidence.score ?? 100) <= 60;
  const visibleHotspots = selectedJob?.hotspots?.filter((hotspot) => hotspot.status !== 'archived') ?? [];

  useEffect(() => {
    if (!selectedJob || !hasRunningAiRun) return undefined;
    const intervalId = window.setInterval(() => {
      void loadAiRuns(selectedJob.id, true);
    }, 2500);
    return () => window.clearInterval(intervalId);
  }, [selectedJob?.id, hasRunningAiRun]);

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
      setCommercialBriefForm(toCommercialBriefForm(data));
      setHotspotForm(emptyHotspotForm);
      setEditingHotspotId(null);
      setGuideTypeOverride('');
      await loadAiRuns(id);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  async function loadAiRuns(captureJobId: string, silent = false): Promise<void> {
    try {
      const data = await unwrapApiResponse<CaptureAiProcessingRun[]>(api.get(`/capture-jobs/${captureJobId}/ai/runs`));
      setAiRuns(Array.isArray(data) ? data : []);
    } catch (err) {
      if (!silent) setError(getApiErrorMessage(err));
    }
  }

  function resetForNew(): void {
    setSelectedJob(null);
    setForm(emptyJobForm);
    setOutputForm(emptyOutputForm);
    setCommercialBriefForm(emptyCommercialBriefForm);
    setHotspotForm(emptyHotspotForm);
    setEditingHotspotId(null);
    setGuideTypeOverride('');
    setAiRuns([]);
    setAiRunsOpen(false);
    setMessage(null);
    setError(null);
  }

  function updateForm<K extends keyof CaptureJobForm>(key: K, value: CaptureJobForm[K]): void {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateOutputForm<K extends keyof OutputForm>(key: K, value: OutputForm[K]): void {
    setOutputForm((current) => ({ ...current, [key]: value }));
  }

  function updateCommercialBrief<K extends keyof CommercialBriefForm>(key: K, value: CommercialBriefForm[K]): void {
    setCommercialBriefForm((current) => ({ ...current, [key]: value }));
  }

  function updateHotspotForm<K extends keyof HotspotForm>(key: K, value: HotspotForm[K]): void {
    setHotspotForm((current) => ({ ...current, [key]: value }));
  }

  function updateOutputType(type: string): void {
    setOutputForm((current) => ({
      ...current,
      type,
      format: current.format && current.format !== 'url' ? current.format : getSuggestedFormat(type)
    }));
  }

  async function copyToClipboard(url: string, successMessage: string): Promise<void> {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setMessage(successMessage);
    } catch {
      setError('No se pudo copiar la URL.');
    }
  }

  async function copyLandingUrl(captureJobId: string): Promise<void> {
    await copyToClipboard(getCaptureLandingUrl(captureJobId), 'Landing pública copiada.');
  }

  async function copyViewerUrl(url: string): Promise<void> {
    await copyToClipboard(url, 'Viewer externo copiado.');
  }

  async function copyAiSection(label: string, value: unknown): Promise<void> {
    await copyToClipboard(stringifyAiSection(value), `${label} copiado.`);
  }

  async function processWithAi(): Promise<void> {
    if (!selectedJob || hasRunningAiRun) return;
    setAiProcessing(true);
    setError(null);
    setMessage(null);
    try {
      const run = await unwrapApiResponse<CaptureAiProcessingRun>(api.post(`/capture-jobs/${selectedJob.id}/ai/process`));
      setAiRuns((current) => [run, ...current.filter((item) => item.id !== run.id)]);
      setMessage('Procesamiento IA iniciado. Actualizando resultado...');
      await loadAiRuns(selectedJob.id);
    } catch (err) {
      if (isClientTimeout(err)) {
        setMessage('El procesamiento sigue en curso. Actualizando resultado...');
      } else {
        setError(getApiErrorMessage(err));
      }
      await loadAiRuns(selectedJob.id);
    } finally {
      setAiProcessing(false);
    }
  }

  async function saveCommercialBrief(): Promise<void> {
    if (!selectedJob) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const data = await unwrapApiResponse<CaptureJob>(api.put(`/capture-jobs/${selectedJob.id}`, {
        commercialBrief: commercialBriefForm
      }));
      setSelectedJob(data);
      setCommercialBriefForm(toCommercialBriefForm(data));
      setMessage('Briefing comercial guardado.');
      await loadJobs();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function applyAiContent(runId: string): Promise<void> {
    if (!selectedJob) return;
    if (selectedJob.appliedAiContent && !window.confirm('Esto reemplazará el contenido aplicado anterior. ¿Continuar?')) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const data = await unwrapApiResponse<CaptureJob>(api.post(`/capture-jobs/${selectedJob.id}/ai/runs/${runId}/apply-content`));
      setSelectedJob(data);
      setForm(toJobForm(data));
      setMessage('Copy IA aplicado al CaptureJob.');
      await loadJobs();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function createHotspotsFromAi(runId: string): Promise<void> {
    if (!selectedJob) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const data = await unwrapApiResponse<{ created: CaptureHotspot[]; skipped: number }>(api.post(`/capture-jobs/${selectedJob.id}/ai/runs/${runId}/create-hotspots`));
      setMessage(`Hotspots borrador creados: ${data.created.length}. Omitidos por duplicado: ${data.skipped}.`);
      await loadJob(selectedJob.id);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function editHotspot(hotspot: CaptureHotspot): void {
    setEditingHotspotId(hotspot.id);
    setHotspotForm({
      label: hotspot.label,
      description: hotspot.description,
      roomOrZone: hotspot.roomOrZone,
      hotspotType: hotspot.hotspotType,
      priority: hotspot.priority,
      cta: hotspot.cta,
      mediaSuggestion: hotspot.mediaSuggestion,
      businessObjective: hotspot.businessObjective,
      sortOrder: String(hotspot.sortOrder)
    });
  }

  async function saveHotspot(): Promise<void> {
    if (!selectedJob) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    const payload = {
      ...hotspotForm,
      sortOrder: Number(hotspotForm.sortOrder) || 0
    };
    try {
      if (editingHotspotId) {
        await unwrapApiResponse<CaptureHotspot>(api.put(`/capture-jobs/${selectedJob.id}/hotspots/${editingHotspotId}`, payload));
        setMessage('Hotspot actualizado.');
      } else {
        await unwrapApiResponse<CaptureHotspot>(api.post(`/capture-jobs/${selectedJob.id}/hotspots`, payload));
        setMessage('Hotspot manual creado.');
      }
      setHotspotForm(emptyHotspotForm);
      setEditingHotspotId(null);
      await loadJob(selectedJob.id);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function patchHotspot(hotspot: CaptureHotspot, patch: Partial<CaptureHotspot>): Promise<void> {
    if (!selectedJob) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await unwrapApiResponse<CaptureHotspot>(api.put(`/capture-jobs/${selectedJob.id}/hotspots/${hotspot.id}`, patch));
      setMessage('Hotspot actualizado.');
      await loadJob(selectedJob.id);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function archiveHotspot(hotspot: CaptureHotspot): Promise<void> {
    if (!selectedJob) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await unwrapApiResponse<CaptureHotspot>(api.delete(`/capture-jobs/${selectedJob.id}/hotspots/${hotspot.id}`));
      setMessage('Hotspot archivado.');
      await loadJob(selectedJob.id);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
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
          <p className="text-xs font-black uppercase tracking-[0.22em] text-ip-accent">Operación visual</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950 dark:text-white">Capture Jobs</h1>
          <p className="mt-2 max-w-2xl text-sm font-semibold text-slate-500 dark:text-white/45">
            Gestiona material recibido, QA, outputs, URL pública y conexión básica con propiedades o leads.
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
                  <th className="px-4 py-3">Próxima acción</th>
                  <th className="px-4 py-3">Assets</th>
                  <th className="px-4 py-3">3D</th>
                  <th className="px-4 py-3">Público</th>
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
                    <td className="px-4 py-3">
                      {isPublicCaptureStatus(job.status) ? (
                        <Link to={getCaptureLandingPath(job.id)} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-xs font-black text-ip-accent">
                          <ExternalLink className="h-3 w-3" /> Ver landing
                        </Link>
                      ) : (
                        <span className="max-w-[140px] text-[10px] font-bold leading-4 text-amber-600 dark:text-amber-300">
                          Publica el CaptureJob para activar la entrega pública.
                        </span>
                      )}
                    </td>
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
                <FieldLabel>Título</FieldLabel>
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
                <FieldLabel>Próxima acción</FieldLabel>
                <input value={form.nextAction} onChange={(e) => updateForm('nextAction', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-white/5" />
              </div>
              <div className="sm:col-span-2">
                <FieldLabel>Public URL manual / QR</FieldLabel>
                <input value={form.publicUrl} onChange={(e) => updateForm('publicUrl', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-white/5" />
                <p className="mt-1 text-[11px] font-bold text-slate-400 dark:text-white/35">
                  La entrega principal se abre siempre en {selectedJob ? getCaptureLandingPath(selectedJob.id) : '/capture/{id}'}.
                </p>
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
              {selectedJob && isPublicCaptureStatus(selectedJob.status) ? (
                <>
                  <Link to={getCaptureLandingPath(selectedJob.id)} className="inline-flex items-center gap-2 rounded-full bg-ip-accent px-4 py-2 text-sm font-black text-white hover:bg-ip-accent-hover">
                    Ver landing pública <ExternalLink className="h-4 w-4" />
                  </Link>
                  <button type="button" onClick={() => { void copyLandingUrl(selectedJob.id); }} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-white/70 dark:hover:bg-white/5">
                    <Copy className="h-4 w-4" /> Copiar landing pública
                  </button>
                </>
              ) : null}
            </div>
            {selectedJob && !isPublicCaptureStatus(selectedJob.status) ? (
              <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs font-bold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                Publica el CaptureJob para activar la entrega pública.
              </p>
            ) : null}
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

              {(() => {
                const primary3d = getPrimaryPremium3dOutput(selectedJob);
                const guideType = guideTypeOverride || inferCaptureGuideType(selectedJob);
                const materialState = getMaterialState(selectedJob);
                const guideWarnings = getCaptureGuideWarnings(selectedJob, guideType, primary3d);
                const inputSummary = summarizeInputAssets(selectedJob);
                const stateClass = materialState.tone === 'success'
                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-800/50'
                  : materialState.tone === 'danger'
                    ? 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/30 dark:text-red-300 dark:ring-red-800/50'
                    : 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-800/50';
                return (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-white/40">Captura guiada</p>
                        <h3 className="mt-1 text-base font-black text-slate-950 dark:text-white">{getCaptureGuideLabel(guideType)}</h3>
                        <p className="mt-1 text-xs font-bold text-slate-500 dark:text-white/50">{getCaptureGuideText(guideType)}</p>
                      </div>
                      <div className="shrink-0">
                        <select
                          value={guideType}
                          onChange={(event) => setGuideTypeOverride(event.target.value as CaptureGuideType)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black dark:border-white/10 dark:bg-slate-950"
                        >
                          {CAPTURE_GUIDE_TYPES.map((type) => (
                            <option key={type} value={type}>{getCaptureGuideLabel(type)}</option>
                          ))}
                        </select>
                        <p className="mt-1 text-[10px] font-bold text-slate-400">Selector local, no cambia el job.</p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_170px]">
                      <div className="grid gap-2 sm:grid-cols-2">
                        {getCaptureChecklist(guideType).map((item) => (
                          <div key={item} className="flex items-start gap-2 rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-600 dark:bg-slate-950 dark:text-white/60">
                            <span className="mt-0.5 text-slate-400">□</span>
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-2">
                        <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em] ring-1 ${stateClass}`}>
                          {materialState.label}
                        </span>
                        <p className="text-xs font-bold leading-5 text-slate-500 dark:text-white/50">{materialState.detail}</p>
                        <div className="rounded-lg bg-white px-3 py-2 dark:bg-slate-950">
                          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Inputs</p>
                          <p className="mt-1 text-xs font-bold text-slate-600 dark:text-white/60">
                            {(selectedJob.inputAssets?.length ?? 0) > 0 ? `${selectedJob.inputAssets?.length ?? 0} registrados` : '0 registrados'}
                          </p>
                          {inputSummary.length > 0 ? (
                            <p className="mt-1 text-[10px] font-bold text-slate-400">{inputSummary.join(' · ')}</p>
                          ) : null}
                        </div>
                        {primary3d ? (
                          <div className="rounded-lg bg-white px-3 py-2 dark:bg-slate-950">
                            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-violet-500">Output 3D detectado</p>
                            <p className="mt-1 text-xs font-bold text-slate-600 dark:text-white/60">Provider: {getProviderLabel(primary3d)}</p>
                            <p className="mt-1 text-[10px] font-bold text-slate-400">
                              {primary3d.viewerReady ? 'Desktop OK' : 'Desktop pendiente'} · {primary3d.mobileReady ? 'Mobile OK' : 'Mobile pendiente'} · {getOutputUrl(primary3d) ? 'Fallback externo OK' : 'Fallback pendiente'}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {guideWarnings.length > 0 ? (
                      <div className="mt-3 space-y-1">
                        {guideWarnings.map((warning) => (
                          <p key={warning} className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">{warning}</p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })()}

              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-white/40">Briefing comercial</p>
                    <h3 className="mt-1 text-base font-black text-slate-950 dark:text-white">Contexto para mejorar la IA</h3>
                    <p className="mt-1 text-xs font-bold leading-5 text-slate-500 dark:text-white/50">
                      Cuanto más completo sea el briefing, mejor serán los hotspots, copy y guion generados.
                    </p>
                  </div>
                  <div className="shrink-0 text-left sm:text-right">
                    <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em] ring-1 ${commercialBriefCompleteness >= 70 ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-800/50' : commercialBriefCompleteness >= 40 ? 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-800/50' : 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/30 dark:text-red-300 dark:ring-red-800/50'}`}>
                      Contexto {commercialBriefCompleteness}%
                    </span>
                    {commercialBriefCompleteness < 40 ? (
                      <p className="mt-2 text-xs font-bold text-amber-700 dark:text-amber-300">Resultado limitado por falta de material/contexto.</p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <input value={commercialBriefForm.propertyType} onChange={(e) => updateCommercialBrief('propertyType', e.target.value)} placeholder="Tipo de inmueble / activo" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-slate-900" />
                  <input value={commercialBriefForm.location} onChange={(e) => updateCommercialBrief('location', e.target.value)} placeholder="Ubicación" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-slate-900" />
                  <input value={commercialBriefForm.surface} onChange={(e) => updateCommercialBrief('surface', e.target.value)} placeholder="Superficie / tamaño" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-slate-900" />
                  <input value={commercialBriefForm.rooms} onChange={(e) => updateCommercialBrief('rooms', e.target.value)} placeholder="Habitaciones / zonas clave" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-slate-900" />
                  <input value={commercialBriefForm.bathrooms} onChange={(e) => updateCommercialBrief('bathrooms', e.target.value)} placeholder="Baños / equipamiento" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-slate-900" />
                  <input value={commercialBriefForm.priceRange} onChange={(e) => updateCommercialBrief('priceRange', e.target.value)} placeholder="Rango de precio / valor comercial" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-slate-900" />
                  <input value={commercialBriefForm.targetAudience} onChange={(e) => updateCommercialBrief('targetAudience', e.target.value)} placeholder="Público objetivo" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-slate-900" />
                  <input value={commercialBriefForm.salesObjective} onChange={(e) => updateCommercialBrief('salesObjective', e.target.value)} placeholder="Objetivo comercial" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-slate-900" />
                  <textarea value={listToText(commercialBriefForm.keyBenefits)} onChange={(e) => updateCommercialBrief('keyBenefits', textToList(e.target.value))} rows={3} placeholder="Beneficios clave, uno por línea" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-slate-900" />
                  <textarea value={listToText(commercialBriefForm.differentiators)} onChange={(e) => updateCommercialBrief('differentiators', textToList(e.target.value))} rows={3} placeholder="Diferenciales, uno por línea" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-slate-900" />
                  <select value={commercialBriefForm.tone} onChange={(e) => updateCommercialBrief('tone', e.target.value as CommercialBriefForm['tone'])} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-slate-900">
                    <option value="professional">Profesional</option>
                    <option value="premium">Premium</option>
                    <option value="direct">Directo</option>
                    <option value="inspirational">Inspiracional</option>
                    <option value="technical">Técnico</option>
                  </select>
                  <select value={commercialBriefForm.ctaGoal} onChange={(e) => updateCommercialBrief('ctaGoal', e.target.value as CommercialBriefForm['ctaGoal'])} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-slate-900">
                    <option value="contact">Contacto</option>
                    <option value="book_visit">Reservar visita</option>
                    <option value="request_info">Solicitar información</option>
                    <option value="download">Descarga</option>
                    <option value="call">Llamada</option>
                  </select>
                  <textarea value={commercialBriefForm.brandNotes} onChange={(e) => updateCommercialBrief('brandNotes', e.target.value)} rows={3} placeholder="Notas de marca" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-slate-900" />
                  <textarea value={commercialBriefForm.constraints} onChange={(e) => updateCommercialBrief('constraints', e.target.value)} rows={3} placeholder="Restricciones / cosas a evitar" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-slate-900" />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => { void saveCommercialBrief(); }} disabled={saving} className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-950">
                    Guardar briefing
                  </button>
                  <button type="button" onClick={() => setCommercialBriefForm(emptyCommercialBriefForm)} disabled={saving} className="rounded-full border border-slate-200 px-4 py-2 text-xs font-black text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-white/60 dark:hover:bg-white/5">
                    Limpiar campos
                  </button>
                  <p className="text-xs font-bold text-slate-400">Usar briefing en IA: se aplica automáticamente al reprocesar.</p>
                </div>
              </div>

              {(() => {
                const latestRun = latestAiRun;
                const result: CaptureAiProcessingResult | null = latestRun?.result ?? null;
                return (
                  <div className="rounded-xl border border-sky-200 bg-sky-50/80 p-4 dark:border-sky-900/50 dark:bg-sky-950/20">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-600 dark:text-sky-300">Procesamiento IA</p>
                        <h3 className="mt-1 text-base font-black text-slate-950 dark:text-white">Propuesta asistida para CaptureJob</h3>
                        <p className="mt-1 text-xs font-bold leading-5 text-slate-500 dark:text-white/50">
                          Analiza datos existentes, assets resumidos, captura guiada y QA. No modifica el job ni publica entregables.
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => { void processWithAi(); }}
                          disabled={aiProcessing || hasRunningAiRun}
                          className="inline-flex items-center justify-center gap-2 rounded-full bg-sky-600 px-4 py-2 text-xs font-black text-white hover:bg-sky-500 disabled:opacity-50"
                        >
                          <BrainCircuit className="h-4 w-4" /> {aiProcessing || hasRunningAiRun ? 'Procesando...' : 'Procesar con IA'}
                        </button>
                        <button
                          type="button"
                          onClick={() => { if (selectedJob) void loadAiRuns(selectedJob.id); }}
                          className="inline-flex items-center justify-center gap-2 rounded-full border border-sky-200 bg-white px-4 py-2 text-xs font-black text-sky-700 hover:bg-sky-50 dark:border-sky-900/50 dark:bg-slate-950 dark:text-sky-300 dark:hover:bg-sky-950/30"
                        >
                          <RefreshCw className="h-4 w-4" /> Actualizar resultado
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      <p className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-500 dark:bg-slate-950 dark:text-white/50">
                        Contexto disponible: <span className="font-black text-slate-800 dark:text-white">{commercialBriefCompleteness}%</span>
                      </p>
                      <p className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-500 dark:bg-slate-950 dark:text-white/50">
                        InputAssets: <span className="font-black text-slate-800 dark:text-white">{selectedJob.inputAssets?.length ?? 0}</span>
                      </p>
                      <p className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-500 dark:bg-slate-950 dark:text-white/50">
                        Output 3D detectado: <span className="font-black text-slate-800 dark:text-white">{getPrimaryPremium3dOutput(selectedJob) ? 'sí' : 'no'}</span>
                      </p>
                    </div>
                    {contextLimited ? (
                      <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                        Resultado limitado por falta de material/contexto.
                      </p>
                    ) : null}

                    {!latestRun ? (
                      <p className="mt-4 rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-500 dark:bg-slate-950 dark:text-white/50">
                        Aun no hay procesamientos IA para este CaptureJob. Ejecuta el analisis cuando el material base y las notas internas esten razonablemente completos.
                      </p>
                    ) : (
                      <div className="mt-4 space-y-3">
                        {latestRun.status === 'running' ? (
                          <p className="rounded-lg bg-sky-100 px-3 py-2 text-xs font-bold text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                            Procesamiento en curso. La pagina actualiza el resultado automaticamente cada pocos segundos.
                          </p>
                        ) : null}
                        {hasStaleRunningAiRun ? (
                          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                            Procesamiento anterior sigue marcado como running. Revisa o reintenta mas tarde.
                          </p>
                        ) : null}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ring-1 ${latestRun.status === 'completed' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-800/50' : latestRun.status === 'failed' ? 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/30 dark:text-red-300 dark:ring-red-800/50' : 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-800/50'}`}>
                            {latestRun.status}
                          </span>
                          <span className="text-xs font-bold text-slate-500 dark:text-white/50">{formatRunDate(latestRun.createdAt)}</span>
                          {latestRun.model ? <span className="text-xs font-bold text-slate-400">{latestRun.model}</span> : null}
                          {result ? <span className="text-xs font-black text-sky-700 dark:text-sky-300">Confidence {result.confidence.score}/100</span> : null}
                        </div>

                        {latestRun.status === 'completed' && result ? (
                          <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => { void applyAiContent(latestRun.id); }} disabled={saving} className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-950">
                              Aplicar copy al CaptureJob
                            </button>
                            <button type="button" onClick={() => { void createHotspotsFromAi(latestRun.id); }} disabled={saving} className="rounded-full border border-sky-200 px-4 py-2 text-xs font-black text-sky-700 hover:bg-sky-50 disabled:opacity-50 dark:border-sky-900/50 dark:text-sky-300 dark:hover:bg-sky-950/30">
                              Crear hotspots borrador
                            </button>
                            <button type="button" onClick={() => { void applyAiContent(latestRun.id); }} disabled={saving} className="rounded-full border border-slate-200 px-4 py-2 text-xs font-black text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-white/60 dark:hover:bg-white/5">
                              Crear checklist de producción
                            </button>
                          </div>
                        ) : null}

                        {latestRun.error ? (
                          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700 dark:bg-red-950/30 dark:text-red-300">{getAiRunErrorMessage(latestRun.error)}</p>
                        ) : null}

                        {result ? (
                          <div className="grid gap-3">
                            <div className="rounded-lg bg-white p-3 dark:bg-slate-950">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Estructura recomendada</p>
                                  <h4 className="mt-1 text-sm font-black text-slate-900 dark:text-white">{result.experienceStructure.recommendedTitle}</h4>
                                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-500 dark:text-white/50">{result.experienceStructure.intro}</p>
                                </div>
                                <button type="button" onClick={() => { void copyAiSection('Estructura', result.experienceStructure); }} className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-[10px] font-black text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-white/70 dark:hover:bg-white/5">
                                  <Copy className="h-3 w-3" /> Copiar
                                </button>
                              </div>
                              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                {result.experienceStructure.sections.slice(0, 4).map((section) => (
                                  <p key={`${section.title}-${section.objective}`} className="rounded-lg bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-500 dark:bg-white/5 dark:text-white/50">
                                    <span className="font-black text-slate-700 dark:text-white/70">{section.title}</span> · {section.objective}
                                  </p>
                                ))}
                              </div>
                            </div>

                            <div className="grid gap-3 lg:grid-cols-2">
                              <div className="rounded-lg bg-white p-3 dark:bg-slate-950">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Hotspots sugeridos</p>
                                  <button type="button" onClick={() => { void copyAiSection('Hotspots', result.suggestedHotspots); }} className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-[10px] font-black text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-white/70 dark:hover:bg-white/5">
                                    <Copy className="h-3 w-3" /> Copiar
                                  </button>
                                </div>
                                <div className="mt-2 space-y-2">
                                  {result.suggestedHotspots.slice(0, 4).map((hotspot) => (
                                    <p key={`${hotspot.label}-${hotspot.roomOrZone}`} className="text-xs font-semibold leading-5 text-slate-500 dark:text-white/50">
                                      <span className="font-black text-slate-800 dark:text-white">{hotspot.label}</span> · {hotspot.roomOrZone} · {hotspot.priority}
                                    </p>
                                  ))}
                                </div>
                              </div>

                              <div className="rounded-lg bg-white p-3 dark:bg-slate-950">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Copy comercial</p>
                                  <button type="button" onClick={() => { void copyAiSection('Copy comercial', result.commercialCopy); }} className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-[10px] font-black text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-white/70 dark:hover:bg-white/5">
                                    <Copy className="h-3 w-3" /> Copiar
                                  </button>
                                </div>
                                {hasCommercialCopyContent(result) ? (
                                  <div className="mt-2 space-y-2">
                                    {result.commercialCopy.shortDescription ? <p className="text-xs font-semibold leading-5 text-slate-500 dark:text-white/50">{result.commercialCopy.shortDescription}</p> : null}
                                    {result.commercialCopy.longDescription ? <p className="text-xs font-semibold leading-5 text-slate-500 dark:text-white/50">{result.commercialCopy.longDescription}</p> : null}
                                    {result.commercialCopy.salesAngle ? <p className="text-xs font-bold text-sky-700 dark:text-sky-300">{result.commercialCopy.salesAngle}</p> : null}
                                    {result.commercialCopy.targetAudience ? <p className="text-[10px] font-bold text-slate-400">Público: {result.commercialCopy.targetAudience}</p> : null}
                                    {result.commercialCopy.propertyHighlights.length > 0 ? (
                                      <div className="flex flex-wrap gap-1">
                                        {result.commercialCopy.propertyHighlights.slice(0, 4).map((highlight) => (
                                          <span key={highlight} className="rounded-full bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-500 dark:bg-white/5 dark:text-white/50">{highlight}</span>
                                        ))}
                                      </div>
                                    ) : null}
                                    {result.commercialCopy.ctaSuggestions.length > 0 ? <p className="text-[10px] font-black text-sky-700 dark:text-sky-300">CTA: {result.commercialCopy.ctaSuggestions.slice(0, 3).join(' · ')}</p> : null}
                                  </div>
                                ) : (
                                  <p className="mt-2 text-xs font-bold text-slate-400">Sin contenido generado. Reprocesa tras completar briefing/material.</p>
                                )}
                              </div>

                              <div className="rounded-lg bg-white p-3 dark:bg-slate-950">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Guion de vídeo</p>
                                  <button type="button" onClick={() => { void copyAiSection('Guion', result.videoScript); }} className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-[10px] font-black text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-white/70 dark:hover:bg-white/5">
                                    <Copy className="h-3 w-3" /> Copiar
                                  </button>
                                </div>
                                {hasVideoScriptContent(result) ? (
                                  <div className="mt-2 space-y-2">
                                    {result.videoScript.hook ? <p className="text-xs font-black text-slate-800 dark:text-white">{result.videoScript.hook}</p> : null}
                                    {result.videoScript.voiceover ? <p className="text-xs font-semibold leading-5 text-slate-500 dark:text-white/50">{result.videoScript.voiceover}</p> : null}
                                    {result.videoScript.sceneList.slice(0, 3).map((scene) => (
                                      <p key={`${scene.scene}-${scene.duration}`} className="rounded-lg bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-500 dark:bg-white/5 dark:text-white/50">
                                        <span className="font-black text-slate-700 dark:text-white/70">{scene.scene}</span> · {scene.visual} · {scene.duration}
                                      </p>
                                    ))}
                                    {result.videoScript.closingCTA ? <p className="text-xs font-bold text-sky-700 dark:text-sky-300">{result.videoScript.closingCTA}</p> : null}
                                    <p className="text-[10px] font-bold text-slate-400">
                                      Formatos: {result.videoScript.formatRecommendations.horizontal || 'horizontal pendiente'} · {result.videoScript.formatRecommendations.vertical || 'vertical pendiente'}
                                    </p>
                                  </div>
                                ) : (
                                  <p className="mt-2 text-xs font-bold text-slate-400">Sin contenido generado. Reprocesa tras completar briefing/material.</p>
                                )}
                              </div>

                              <div className="rounded-lg bg-white p-3 dark:bg-slate-950">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Próximas acciones</p>
                                  <button type="button" onClick={() => { void copyAiSection('Próximas acciones', result.nextActions); }} className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-[10px] font-black text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-white/70 dark:hover:bg-white/5">
                                    <Copy className="h-3 w-3" /> Copiar
                                  </button>
                                </div>
                                <div className="mt-2 space-y-2">
                                  {result.nextActions.length === 0 ? <p className="text-xs font-bold text-slate-400">Sin contenido generado. Reprocesa tras completar briefing/material.</p> : result.nextActions.slice(0, 5).map((action) => (
                                    <p key={`${action.action}-${action.ownerSuggestion}`} className="text-xs font-semibold leading-5 text-slate-500 dark:text-white/50">
                                      <span className="font-black text-slate-800 dark:text-white">{action.priority}</span> · {action.action}
                                      {action.reason ? <span className="block text-[10px] text-slate-400">{action.reason}</span> : null}
                                    </p>
                                  ))}
                                </div>
                              </div>
                            </div>

                            <div className="grid gap-3 lg:grid-cols-2">
                              <div className="rounded-lg bg-white p-3 dark:bg-slate-950">
                                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Material faltante</p>
                                <div className="mt-2 space-y-2">
                                  {result.missingMaterial.length === 0 ? <p className="text-xs font-bold text-slate-400">Sin faltantes destacados.</p> : result.missingMaterial.slice(0, 4).map((item) => (
                                    <p key={`${item.item}-${item.reason}`} className="rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                                      {item.severity} · {item.item}: {item.recommendation}
                                    </p>
                                  ))}
                                </div>
                              </div>
                              <div className="rounded-lg bg-white p-3 dark:bg-slate-950">
                                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">QA recomendado</p>
                                <p className="mt-2 text-xs font-black text-slate-800 dark:text-white">Readiness: {statusLabel(result.qaRecommendations.publicationReadiness)}</p>
                                <p className="mt-1 text-xs font-semibold leading-5 text-slate-500 dark:text-white/50">
                                  Desktop: {result.qaRecommendations.desktop.slice(0, 2).join(' · ') || 'Sin contenido generado. Reprocesa tras completar briefing/material.'}
                                </p>
                                <p className="mt-1 text-xs font-semibold leading-5 text-slate-500 dark:text-white/50">
                                  Mobile: {result.qaRecommendations.mobile.slice(0, 2).join(' · ') || 'Sin contenido generado. Reprocesa tras completar briefing/material.'}
                                </p>
                                {result.qaRecommendations.performance.length > 0 ? (
                                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-500 dark:text-white/50">
                                    Performance: {result.qaRecommendations.performance.slice(0, 2).join(' · ')}
                                  </p>
                                ) : null}
                                {result.qaRecommendations.viewer.length > 0 ? (
                                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-500 dark:text-white/50">
                                    Viewer: {result.qaRecommendations.viewer.slice(0, 2).join(' · ')}
                                  </p>
                                ) : null}
                                {result.confidence.explanation ? (
                                  <p className="mt-2 rounded-lg bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-500 dark:bg-white/5 dark:text-white/50">{result.confidence.explanation}</p>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        ) : null}

                        {aiRuns.length > 1 ? (
                          <div>
                            <button type="button" onClick={() => setAiRunsOpen((current) => !current)} className="text-xs font-black text-sky-700 hover:text-sky-500 dark:text-sky-300">
                              {aiRunsOpen ? 'Ocultar historial' : `Ver historial (${aiRuns.length - 1})`}
                            </button>
                            {aiRunsOpen ? (
                              <div className="mt-2 space-y-1">
                                {aiRuns.slice(1).map((run) => (
                                  <p key={run.id} className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-500 dark:bg-slate-950 dark:text-white/50">
                                    {formatRunDate(run.createdAt)} · {run.status} · {run.model || 'modelo no registrado'} {run.result ? `· confidence ${run.result.confidence.score}/100` : ''}
                                  </p>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-white/40">Contenido aplicado</p>
                    <h3 className="mt-1 text-base font-black text-slate-950 dark:text-white">{selectedJob.appliedAiContent?.commercialTitle || 'Sin copy aplicado'}</h3>
                    {selectedJob.appliedAiContentUpdatedAt ? <p className="mt-1 text-xs font-bold text-slate-400">Actualizado: {formatRunDate(selectedJob.appliedAiContentUpdatedAt)}</p> : null}
                    {selectedJob.appliedAiContent?.sourceRunId ? <p className="mt-1 text-[10px] font-bold text-slate-400">sourceRunId: {selectedJob.appliedAiContent.sourceRunId}</p> : null}
                  </div>
                  {selectedJob.appliedAiContent ? (
                    <button type="button" onClick={() => { void copyAiSection('Contenido aplicado', selectedJob.appliedAiContent); }} className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-white/70 dark:hover:bg-white/5">
                      <Copy className="h-3.5 w-3.5" /> Copiar contenido aplicado
                    </button>
                  ) : null}
                </div>
                {selectedJob.appliedAiContent ? (
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    <p className="text-xs font-semibold leading-5 text-slate-500 dark:text-white/50">{selectedJob.appliedAiContent.shortDescription || selectedJob.appliedAiContent.longDescription}</p>
                    <p className="text-xs font-bold leading-5 text-sky-700 dark:text-sky-300">{selectedJob.appliedAiContent.salesAngle}</p>
                    {selectedJob.appliedAiContent.benefits.length > 0 ? (
                      <div className="flex flex-wrap gap-1 lg:col-span-2">
                        {selectedJob.appliedAiContent.benefits.slice(0, 6).map((benefit) => (
                          <span key={benefit} className="rounded-full bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-500 dark:bg-slate-950 dark:text-white/50">{benefit}</span>
                        ))}
                      </div>
                    ) : null}
                    {selectedJob.appliedAiContent.nextActions?.length ? (
                      <div className="lg:col-span-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Checklist de producción</p>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          {selectedJob.appliedAiContent.nextActions.slice(0, 6).map((action) => (
                            <p key={`${action.action}-${action.priority}`} className="rounded-lg bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-500 dark:bg-slate-950 dark:text-white/50">
                              <span className="font-black text-slate-700 dark:text-white/70">{action.priority}</span> · {action.action}
                            </p>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-3 text-sm font-semibold text-slate-400">Aplica un run IA completado para guardar copy operativo. Nada se publica automáticamente.</p>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-white/40">Hotspots</p>
                    <h3 className="mt-1 text-base font-black text-slate-950 dark:text-white">{visibleHotspots.length} hotspots operativos</h3>
                  </div>
                  <p className="text-xs font-bold text-slate-400">Publicar = status published + público activo.</p>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <input value={hotspotForm.label} onChange={(e) => updateHotspotForm('label', e.target.value)} placeholder="Label" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-slate-900" />
                  <input value={hotspotForm.roomOrZone} onChange={(e) => updateHotspotForm('roomOrZone', e.target.value)} placeholder="Zona" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-slate-900" />
                  <textarea value={hotspotForm.description} onChange={(e) => updateHotspotForm('description', e.target.value)} rows={2} placeholder="Descripción" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-slate-900 sm:col-span-2" />
                  <select value={hotspotForm.hotspotType} onChange={(e) => updateHotspotForm('hotspotType', e.target.value as HotspotForm['hotspotType'])} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-slate-900">
                    {['info', 'cta', 'navigation', 'feature', 'warning'].map((type) => <option key={type} value={type}>{statusLabel(type)}</option>)}
                  </select>
                  <select value={hotspotForm.priority} onChange={(e) => updateHotspotForm('priority', e.target.value as HotspotForm['priority'])} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-slate-900">
                    {['low', 'medium', 'high'].map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                  </select>
                  <input value={hotspotForm.cta} onChange={(e) => updateHotspotForm('cta', e.target.value)} placeholder="CTA" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-slate-900" />
                  <input value={hotspotForm.sortOrder} onChange={(e) => updateHotspotForm('sortOrder', e.target.value)} placeholder="Orden" inputMode="numeric" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-slate-900" />
                  <input value={hotspotForm.mediaSuggestion} onChange={(e) => updateHotspotForm('mediaSuggestion', e.target.value)} placeholder="Sugerencia media" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-slate-900" />
                  <input value={hotspotForm.businessObjective} onChange={(e) => updateHotspotForm('businessObjective', e.target.value)} placeholder="Objetivo" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-slate-900" />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => { void saveHotspot(); }} disabled={saving || !hotspotForm.label.trim() || !hotspotForm.description.trim()} className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-950">
                    {editingHotspotId ? 'Guardar hotspot' : 'Crear hotspot manual'}
                  </button>
                  {editingHotspotId ? (
                    <button type="button" onClick={() => { setEditingHotspotId(null); setHotspotForm(emptyHotspotForm); }} disabled={saving} className="rounded-full border border-slate-200 px-4 py-2 text-xs font-black text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-white/60 dark:hover:bg-white/5">
                      Cancelar edición
                    </button>
                  ) : null}
                </div>

                <div className="mt-4 space-y-2">
                  {visibleHotspots.length === 0 ? <p className="text-sm font-semibold text-slate-400">Sin hotspots. Crea borradores desde IA o manualmente.</p> : visibleHotspots.map((hotspot) => (
                    <div key={hotspot.id} className="rounded-xl border border-slate-100 p-3 dark:border-white/10">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-sm font-black text-slate-900 dark:text-white">{hotspot.label}</h4>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] ${hotspot.status === 'published' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300' : hotspot.status === 'approved' ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300' : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-white/60'}`}>{hotspot.status}</span>
                            {hotspot.isPublic ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">público</span> : null}
                          </div>
                          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500 dark:text-white/50">{hotspot.roomOrZone ? `${hotspot.roomOrZone} · ` : ''}{hotspot.description}</p>
                          <p className="mt-1 text-[10px] font-bold text-slate-400">{hotspot.hotspotType} · {hotspot.priority}{hotspot.cta ? ` · CTA: ${hotspot.cta}` : ''}</p>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <button type="button" onClick={() => editHotspot(hotspot)} className="rounded-full border border-slate-200 px-2 py-1 text-[10px] font-black text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-white/60">Editar</button>
                          <button type="button" onClick={() => { void patchHotspot(hotspot, { status: 'approved', isPublic: false }); }} className="rounded-full border border-sky-200 px-2 py-1 text-[10px] font-black text-sky-700 hover:bg-sky-50 dark:border-sky-900/50 dark:text-sky-300">Aprobar</button>
                          <button type="button" onClick={() => { void patchHotspot(hotspot, { status: 'published', isPublic: true }); }} className="rounded-full border border-emerald-200 px-2 py-1 text-[10px] font-black text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/50 dark:text-emerald-300">Publicar</button>
                          <button type="button" onClick={() => { void patchHotspot(hotspot, { status: 'draft', isPublic: false }); }} className="rounded-full border border-slate-200 px-2 py-1 text-[10px] font-black text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-white/60">Ocultar</button>
                          <button type="button" onClick={() => { void archiveHotspot(hotspot); }} className="rounded-full border border-red-200 px-2 py-1 text-[10px] font-black text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:text-red-300">Archivar</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

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
                            <ExternalLink className="h-3 w-3" /> Abrir viewer externo
                          </a>
                          <button type="button" onClick={() => { void copyViewerUrl(getOutputUrl(asset)); }} className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-[10px] font-black text-slate-600 hover:bg-white dark:border-white/10 dark:text-white/70 dark:hover:bg-white/5">
                            <Copy className="h-3 w-3" /> Copiar viewer externo
                          </button>
                        </div>
                      </div>
                      {isPremium3dOutput(asset.type) ? (
                        <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                          Uso interno / fallback técnico
                        </p>
                      ) : null}
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

            </div>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
