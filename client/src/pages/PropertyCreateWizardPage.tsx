import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBrand } from '@/hooks/useBrand';
import { api, unwrapApiResponse, getApiErrorMessage } from '@/services/api';
import { usePropertyStore } from '@/store/propertyStore';
import type { CreateSpacePayload, CreatePropertyPayload } from '@/store/propertyStore';
import type { UploadAssetResponse } from '@/types/api';

// ── Upload error humanizer ────────────────────────────────────────────────────
function humanizeUploadError(raw: string): string {
  const msg = (raw ?? '').toLowerCase();
  if (msg.includes('extension') || msg.includes('formato') || msg.includes('not permitted') || msg.includes('not allowed') || msg.includes('tipo')) {
    return 'Formato no admitido. Usa JPG, PNG, WEBP para panoramas o PLY, SPLAT para Gaussian.';
  }
  if (msg.includes('supera') || msg.includes('limit') || msg.includes('too large') || msg.includes('size') || msg.includes('grande')) {
    return 'Archivo demasiado grande. El límite es 500 MB. Comprime con SuperSplat antes de subir.';
  }
  if (msg.includes('network') || msg.includes('connection') || msg.includes('fetch') || msg.includes('timeout') || msg.includes('conexi')) {
    return 'Error de conexión. Comprueba tu wifi e inténtalo de nuevo.';
  }
  return 'Error al subir. Comprueba tu conexión e inténtalo de nuevo.';
}

// ── Room detection from filename ──────────────────────────────────────────────
interface RoomDefaults {
  name: string;
  ctaLabel: string;
  storySubheadline: string;
}

const ROOM_RULES: Array<{ pattern: RegExp } & RoomDefaults> = [
  {
    pattern: /living|sal[oó]n|salon|lounge|estar/i,
    name: 'Salón',
    ctaLabel: 'Solicitar visita',
    storySubheadline: 'El corazón de la vivienda'
  },
  {
    pattern: /kitchen|cocina|cook/i,
    name: 'Cocina',
    ctaLabel: 'Pedir información',
    storySubheadline: 'Diseño funcional'
  },
  {
    pattern: /bedroom|dormitorio|suite|habitaci[oó]n|cuarto|master/i,
    name: 'Dormitorio',
    ctaLabel: 'Consultar disponibilidad',
    storySubheadline: 'Descanso y privacidad'
  },
  {
    pattern: /terrace|terraza|balc[oó]n|balcony|patio/i,
    name: 'Terraza',
    ctaLabel: 'Quiero verla en persona',
    storySubheadline: 'Tu espacio al aire libre'
  },
  {
    pattern: /entrance|entrada|hall|foyer|recibidor/i,
    name: 'Entrada',
    ctaLabel: 'Ver el recorrido completo',
    storySubheadline: 'Primera impresión'
  },
  {
    pattern: /bath|ba[nñ]o|wc|toilet/i,
    name: 'Baño',
    ctaLabel: 'Ver más detalles',
    storySubheadline: 'Acabados de calidad'
  },
  {
    pattern: /office|estudio|despacho|study/i,
    name: 'Estudio',
    ctaLabel: 'Pedir información',
    storySubheadline: 'Espacio de trabajo'
  }
];

function detectRoom(filename: string): RoomDefaults {
  const stem = filename.replace(/\.[^.]+$/, '');
  for (const rule of ROOM_RULES) {
    if (rule.pattern.test(stem)) {
      return { name: rule.name, ctaLabel: rule.ctaLabel, storySubheadline: rule.storySubheadline };
    }
  }
  // Generic: clean up filename as space name
  const friendly = stem
    .replace(/[-_]+/g, ' ')
    .replace(/\d+/g, '')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .slice(0, 40);
  return {
    name: friendly || 'Espacio',
    ctaLabel: 'Solicitar visita',
    storySubheadline: ''
  };
}

// ── Upload item state ─────────────────────────────────────────────────────────
type UploadStatus = 'queued' | 'uploading' | 'done' | 'error';

interface UploadItem {
  localId: string;
  file: File;
  spaceName: string;
  ctaLabel: string;
  storySubheadline: string;
  status: UploadStatus;
  progress: number;
  url?: string;
  thumbnailUrl?: string;
  format?: string;
  sizeMb?: number;
  errorMsg?: string;
}

// ── Space created in step 2 ───────────────────────────────────────────────────
interface CreatedSpace {
  id: string;
  name: string;
  order: number;
  thumbnailUrl?: string;
}

// ── Property type options ─────────────────────────────────────────────────────
const PROP_TYPES = [
  { value: 'APARTMENT', label: 'Apartamento' },
  { value: 'HOUSE', label: 'Casa' },
  { value: 'VILLA', label: 'Villa' },
  { value: 'OFFICE', label: 'Oficina' },
  { value: 'COMMERCIAL', label: 'Comercial' }
];

const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'splat', 'ply', 'glb'];

// ── Step indicator ────────────────────────────────────────────────────────────
function StepIndicator({
  current,
  total,
  labels,
  color
}: {
  current: number;
  total: number;
  labels: string[];
  color: string;
}): JSX.Element {
  return (
    <div className="mb-8 flex items-start gap-0">
      {labels.map((label, i) => {
        const stepNum = i + 1;
        const isDone = stepNum < current;
        const isActive = stepNum === current;
        const isLast = i === labels.length - 1;
        return (
          <div key={label} className="flex flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              {/* left connector */}
              <div
                className={`h-0.5 flex-1 ${i === 0 ? 'invisible' : isDone || isActive ? '' : 'bg-slate-200'}`}
                style={i !== 0 && (isDone || isActive) ? { backgroundColor: color } : undefined}
              />
              {/* circle */}
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black transition-all ${
                  isDone
                    ? 'text-white'
                    : isActive
                    ? 'text-white shadow-lg'
                    : 'border-2 border-slate-200 bg-white text-slate-400'
                }`}
                style={isDone || isActive ? { backgroundColor: color } : undefined}
              >
                {isDone ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-4 w-4">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  stepNum
                )}
              </div>
              {/* right connector */}
              <div
                className={`h-0.5 flex-1 ${isLast ? 'invisible' : isDone ? '' : 'bg-slate-200'}`}
                style={!isLast && isDone ? { backgroundColor: color } : undefined}
              />
            </div>
            <span
              className={`mt-1.5 text-center text-[10px] font-black uppercase tracking-wider ${
                isActive ? 'text-slate-800 dark:text-slate-100' : isDone ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main wizard ───────────────────────────────────────────────────────────────
export default function PropertyCreateWizardPage(): JSX.Element {
  const navigate = useNavigate();
  const { bgStyle, color } = useBrand();
  const { createProperty, updateProperty, createSpace, updateSpace, createAsset } = usePropertyStore();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Step 1 — basic data
  const [title, setTitle] = useState('');
  const [propType, setPropType] = useState('APARTMENT');
  const [description, setDescription] = useState('');
  const [showDesc, setShowDesc] = useState(false);
  const [price, setPrice] = useState('');
  const [rooms, setRooms] = useState('');
  const [area, setArea] = useState('');
  const [showExtras, setShowExtras] = useState(false);

  // Step 2 — uploads
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 3 — reorder
  const [spaces, setSpaces] = useState<CreatedSpace[]>([]);

  // Step 2 — capture method selector
  const [captureMethod, setCaptureMethod] = useState<'360' | 'gaussian' | 'files' | null>(null);

  // Step 4 — published
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const STEP_LABELS = ['Datos', 'Archivos', 'Orden', 'Publicar'];

  // ── Step 1: create property ─────────────────────────────────────────────────
  async function handleStep1(): Promise<void> {
    if (title.trim().length < 2) {
      setError('El nombre del recorrido debe tener al menos 2 caracteres.');
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      const payload: CreatePropertyPayload = {
        title: title.trim(),
        type: propType,
        status: 'DRAFT',
        description: description.trim() || undefined,
        price: price ? Number(price) : undefined,
        rooms: rooms ? Number(rooms) : undefined,
        area: area ? Number(area) : undefined
      };
      const property = await createProperty(payload);
      setPropertyId(property.id);
      setStep(2);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }

  // ── Step 2: upload single file ──────────────────────────────────────────────
  const uploadFile = useCallback(async (localId: string, file: File): Promise<void> => {
    const formData = new FormData();
    formData.append('file', file);

    setUploads((prev) =>
      prev.map((u) => (u.localId === localId ? { ...u, status: 'uploading' as const, progress: 5 } : u))
    );

    try {
      const upload = await unwrapApiResponse<UploadAssetResponse>(
        api.post('/uploads', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (ev) => {
            const pct = ev.total ? Math.round((ev.loaded / ev.total) * 90) : 0;
            setUploads((prev) =>
              prev.map((u) => (u.localId === localId ? { ...u, progress: Math.max(5, pct) } : u))
            );
          }
        })
      );

      const sizeMb =
        Math.round(((upload.bytes || upload.size || file.size) / (1024 * 1024)) * 100) / 100;
      const fmt = (upload.format || file.name.split('.').pop() || 'jpg').toLowerCase();

      setUploads((prev) =>
        prev.map((u) =>
          u.localId === localId
            ? {
                ...u,
                status: 'done' as const,
                progress: 100,
                url: upload.url,
                thumbnailUrl: upload.thumbnailUrl || undefined,
                format: fmt,
                sizeMb
              }
            : u
        )
      );
    } catch (err) {
      setUploads((prev) =>
        prev.map((u) =>
          u.localId === localId
            ? { ...u, status: 'error' as const, errorMsg: getApiErrorMessage(err) }
            : u
        )
      );
    }
  }, []);

  function addFiles(fileList: FileList | null): void {
    if (!fileList || fileList.length === 0) return;
    const newItems: UploadItem[] = [];
    for (const file of Array.from(fileList)) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (!ALLOWED_EXTENSIONS.includes(ext)) continue;
      const localId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const { name, ctaLabel, storySubheadline } = detectRoom(file.name);
      newItems.push({
        localId,
        file,
        spaceName: name,
        ctaLabel,
        storySubheadline,
        status: 'queued',
        progress: 0
      });
    }
    if (newItems.length === 0) return;
    setUploads((prev) => [...prev, ...newItems]);
    // Start uploads
    for (const item of newItems) {
      void uploadFile(item.localId, item.file);
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>): void {
    e.preventDefault();
    setIsDragOver(false);
    addFiles(e.dataTransfer.files);
  }

  function removeUpload(localId: string): void {
    setUploads((prev) => prev.filter((u) => u.localId !== localId));
  }

  function renameUpload(localId: string, newName: string): void {
    setUploads((prev) => prev.map((u) => (u.localId === localId ? { ...u, spaceName: newName } : u)));
  }

  const allDone =
    uploads.length > 0 && uploads.every((u) => u.status === 'done' || u.status === 'error');
  const hasAnyDone = uploads.some((u) => u.status === 'done');
  const hasUploading = uploads.some((u) => u.status === 'uploading' || u.status === 'queued');

  // ── Step 2 submit: create spaces + assets ───────────────────────────────────
  async function handleStep2(): Promise<void> {
    if (!propertyId) return;
    const doneUploads = uploads.filter((u) => u.status === 'done');

    if (doneUploads.length === 0) {
      // No panoramas — skip ordering step
      setStep(4);
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      const created: CreatedSpace[] = [];
      for (let i = 0; i < doneUploads.length; i++) {
        const u = doneUploads[i];

        // Create space with smart defaults
        const spacePayload: CreateSpacePayload & Record<string, unknown> = {
          name: u.spaceName.trim() || 'Espacio',
          order: i + 1,
          status: 'ACTIVE',
          ...(u.ctaLabel ? { ctaLabel: u.ctaLabel } : {}),
          ...(u.storySubheadline ? { storySubheadline: u.storySubheadline } : {})
        };
        const space = await createSpace(propertyId, spacePayload as CreateSpacePayload);

        // Detect asset type from extension
        const ext = (u.format || 'jpg').toLowerCase();
        const assetType =
          ext === 'glb' ? 'mesh' : ext === 'splat' || ext === 'ply' ? 'gaussian_splat' : 'panorama_360';
        const assetFormat = ['jpg', 'jpeg', 'png', 'webp', 'splat', 'ply', 'glb'].includes(ext)
          ? (ext as 'jpg' | 'jpeg' | 'png' | 'webp' | 'splat' | 'ply' | 'glb')
          : 'jpg';

        await createAsset(propertyId, space.id, {
          type: assetType,
          url: u.url!,
          thumbnail: u.thumbnailUrl || '',
          format: assetFormat,
          size: u.sizeMb || 0,
          hotspots: []
        });

        created.push({
          id: space.id,
          name: u.spaceName.trim() || 'Espacio',
          order: i + 1,
          thumbnailUrl: u.thumbnailUrl
        });
      }
      setSpaces(created);
      setStep(3);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }

  // ── Step 3: reorder spaces ──────────────────────────────────────────────────
  function moveSpace(index: number, dir: -1 | 1): void {
    const target = index + dir;
    if (target < 0 || target >= spaces.length) return;
    const next = [...spaces];
    [next[index], next[target]] = [next[target], next[index]];
    setSpaces(next);
  }

  function renameSpace(index: number, newName: string): void {
    setSpaces((prev) => prev.map((s, i) => (i === index ? { ...s, name: newName } : s)));
  }

  async function handleStep3(): Promise<void> {
    if (!propertyId) return;
    setError(null);
    setIsSaving(true);
    try {
      for (let i = 0; i < spaces.length; i++) {
        await updateSpace(propertyId, spaces[i].id, {
          name: spaces[i].name.trim() || 'Espacio',
          order: i + 1
        });
      }
      setStep(4);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }

  // ── Step 4: publish ─────────────────────────────────────────────────────────
  async function handlePublish(): Promise<void> {
    if (!propertyId) return;
    setError(null);
    setIsSaving(true);
    try {
      await updateProperty(propertyId, { status: 'PUBLISHED' });
      const url = `${window.location.origin}/property/${propertyId}`;
      setPublishedUrl(url);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }

  function handleCopyLink(): void {
    if (!publishedUrl) return;
    void navigator.clipboard.writeText(publishedUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[calc(100vh-140px)] bg-[#F8FAFC] py-8 dark:bg-slate-900">
      <div className="mx-auto max-w-2xl px-4">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">
              Nuevo recorrido
            </h1>
            <p className="mt-0.5 text-sm font-semibold text-slate-500">
              Crea tu experiencia inmersiva en 4 pasos
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/properties')}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-black text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
        </div>

        {/* Step indicator */}
        <StepIndicator current={step} total={4} labels={STEP_LABELS} color={color} />

        {/* Card */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-8">

          {/* ── STEP 1: Basic data ─────────────────────────────────────────── */}
          {step === 1 && (
            <div>
              <h2 className="mb-1 text-lg font-black text-slate-900 dark:text-slate-100">
                Datos del recorrido
              </h2>
              <p className="mb-6 text-sm font-semibold text-slate-500">
                Solo el nombre es obligatorio. El resto lo puedes completar después.
              </p>

              {/* Title */}
              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-300">
                  Nombre del recorrido <span className="text-red-400">*</span>
                </span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleStep1(); }}
                  placeholder="Ej: Ático Lumière · Barcelona"
                  autoFocus
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base font-semibold outline-none transition focus:border-slate-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-500"
                />
              </label>

              {/* Property type pills */}
              <div className="mt-5">
                <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-300">
                  Tipo de inmueble
                </span>
                <div className="flex flex-wrap gap-2">
                  {PROP_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setPropType(t.value)}
                      className={`rounded-full px-4 py-2 text-sm font-black transition ${
                        propType === t.value
                          ? 'text-white shadow'
                          : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300'
                      }`}
                      style={propType === t.value ? bgStyle : undefined}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description toggle */}
              {!showDesc ? (
                <button
                  type="button"
                  onClick={() => setShowDesc(true)}
                  className="mt-5 text-sm font-black"
                  style={{ color }}
                >
                  + Añadir descripción
                </button>
              ) : (
                <label className="mt-5 block">
                  <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-300">
                    Descripción
                  </span>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder="Descripción breve del inmueble…"
                    className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 font-semibold outline-none transition focus:border-slate-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-500"
                  />
                </label>
              )}

              {/* Optional extras toggle */}
              {!showExtras ? (
                <button
                  type="button"
                  onClick={() => setShowExtras(true)}
                  className="mt-3 text-sm font-black"
                  style={{ color }}
                >
                  + Precio, habitaciones y superficie
                </button>
              ) : (
                <div className="mt-5 grid grid-cols-3 gap-3">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-black text-slate-500 uppercase tracking-wider">
                      Precio (€)
                    </span>
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      min={0}
                      placeholder="485000"
                      className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm font-semibold outline-none transition focus:border-slate-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-black text-slate-500 uppercase tracking-wider">
                      Habitaciones
                    </span>
                    <input
                      type="number"
                      value={rooms}
                      onChange={(e) => setRooms(e.target.value)}
                      min={0}
                      placeholder="3"
                      className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm font-semibold outline-none transition focus:border-slate-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-black text-slate-500 uppercase tracking-wider">
                      Superficie (m²)
                    </span>
                    <input
                      type="number"
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      min={0}
                      placeholder="120"
                      className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm font-semibold outline-none transition focus:border-slate-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                    />
                  </label>
                </div>
              )}

              {error && (
                <p className="mt-4 rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 dark:bg-red-900/20 dark:text-red-400">
                  {error}
                </p>
              )}

              <button
                type="button"
                onClick={() => void handleStep1()}
                disabled={isSaving || title.trim().length < 2}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black text-white shadow transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                style={bgStyle}
              >
                {isSaving ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : null}
                Crear y continuar
                {!isSaving && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                )}
              </button>
            </div>
          )}

          {/* ── STEP 2: Upload panoramas ───────────────────────────────────── */}
          {step === 2 && (
            <div>
              <h2 className="mb-1 text-lg font-black text-slate-900 dark:text-slate-100">
                Sube los archivos del recorrido
              </h2>
              <p className="mb-6 text-sm font-semibold text-slate-500">
                Cada archivo se convierte en una estancia. El nombre se detecta automáticamente.
              </p>

              {/* ── Capture method selector (only shown before any upload starts) ── */}
              {uploads.length === 0 && (
                <div className="mb-6">
                  <p className="mb-3 text-xs font-black uppercase tracking-wider text-slate-400">
                    ¿Cómo vas a capturar?
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {(
                      [
                        { id: '360',      icon: '📷', title: 'Foto 360°',         sub: 'Ricoh Theta · Insta360' },
                        { id: 'gaussian', icon: '✨', title: 'Gaussian Splat',    sub: 'Polycam · Luma · LiDAR' },
                        { id: 'files',    icon: '📁', title: 'Ya tengo archivos', sub: 'Subir directamente'     }
                      ] as const
                    ).map((method) => {
                      const isSelected = captureMethod === method.id;
                      return (
                        <button
                          key={method.id}
                          type="button"
                          onClick={() => setCaptureMethod(isSelected ? null : method.id)}
                          className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 px-2 py-4 text-center transition ${
                            isSelected
                              ? 'border-transparent text-white shadow-md'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                          }`}
                          style={isSelected ? bgStyle : undefined}
                        >
                          <span className="text-2xl">{method.icon}</span>
                          <span className="text-xs font-black leading-tight">{method.title}</span>
                          <span className={`text-[10px] font-semibold leading-tight ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                            {method.sub}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* ── Guide: 360° ── */}
                  {captureMethod === '360' && (
                    <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4 dark:border-blue-900/40 dark:bg-blue-950/30">
                      <p className="mb-3 text-xs font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
                        Cómo capturar en 360°
                      </p>
                      <ol className="space-y-2.5">
                        {[
                          'Captura con tu cámara 360° (Ricoh Theta, Insta360) o con Polycam en modo 360°',
                          'Exporta cada habitación como imagen JPG o PNG',
                          'Sube una imagen por habitación — el nombre se detecta automáticamente'
                        ].map((step, i) => (
                          <li key={i} className="flex items-start gap-3">
                            <span
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white"
                              style={bgStyle}
                            >
                              {i + 1}
                            </span>
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{step}</span>
                          </li>
                        ))}
                      </ol>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-4 flex items-center gap-1.5 text-sm font-black"
                        style={{ color }}
                      >
                        Listo, seleccionar archivos
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </button>
                    </div>
                  )}

                  {/* ── Guide: Gaussian ── */}
                  {captureMethod === 'gaussian' && (
                    <div className="mt-4 rounded-2xl border border-purple-100 bg-purple-50 px-5 py-4 dark:border-purple-900/40 dark:bg-purple-950/30">
                      <p className="mb-3 text-xs font-black uppercase tracking-wider text-purple-600 dark:text-purple-400">
                        Cómo capturar Gaussian Splat
                      </p>
                      <ol className="space-y-2.5">
                        {([
                          { text: 'Graba un vídeo lento y fluido de la estancia (Polycam, Luma AI o iPhone con LiDAR)' },
                          { text: 'Exporta el archivo en formato .ply o .splat' },
                          { text: 'Si el archivo pesa más de 500 MB, comprímelo primero con SuperSplat', link: { label: 'Abrir SuperSplat →', url: 'https://supersplat.playcanvas.com' } },
                          { text: 'Sube el archivo aquí — límite máximo 500 MB' }
                        ] as Array<{ text: string; link?: { label: string; url: string } }>).map((step, i) => (
                          <li key={i} className="flex items-start gap-3">
                            <span
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white"
                              style={bgStyle}
                            >
                              {i + 1}
                            </span>
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                              {step.text}
                              {step.link && (
                                <>
                                  {' '}
                                  <a
                                    href={step.link.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-black underline"
                                    style={{ color }}
                                  >
                                    {step.link.label}
                                  </a>
                                </>
                              )}
                            </span>
                          </li>
                        ))}
                      </ol>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-4 flex items-center gap-1.5 text-sm font-black"
                        style={{ color }}
                      >
                        Listo, seleccionar archivos
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </button>
                    </div>
                  )}

                  {/* ── Guide: Ya tengo archivos ── */}
                  {captureMethod === 'files' && (
                    <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 dark:border-emerald-900/40 dark:bg-emerald-950/30">
                      <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                        Perfecto. Selecciona tus archivos en el área de abajo — JPG, PNG, WEBP para panoramas 360° o PLY, SPLAT para Gaussian.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
                  isDragOver
                    ? 'border-current bg-current/5'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700/40'
                }`}
                style={isDragOver ? { borderColor: color, backgroundColor: `${color}10` } : undefined}
              >
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-2xl text-white"
                  style={bgStyle}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-7 w-7">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <div>
                  <p className="hidden font-black text-slate-700 dark:text-slate-200 sm:block">
                    Arrastra los archivos aquí
                  </p>
                  <p className="font-black text-slate-700 dark:text-slate-200 sm:hidden">
                    Toca para seleccionar archivos
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-400">
                    JPG · PNG · WEBP · PLY · SPLAT · GLB
                  </p>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.webp,.splat,.ply,.glb"
                className="hidden"
                onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
              />

              {/* ── Explicit upload button + size/format reminder ── */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-black text-white shadow-sm transition hover:opacity-90 active:scale-95"
                style={bgStyle}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-5 w-5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Subir archivos
              </button>
              <p className="mt-2 text-center text-xs font-semibold text-slate-400">
                Máx. 500 MB · JPG PNG WEBP para panoramas · PLY SPLAT para Gaussian
              </p>

              {/* Upload list */}
              {uploads.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {uploads.map((u) => (
                    <li
                      key={u.localId}
                      className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-700/40"
                    >
                      {/* Thumbnail or placeholder */}
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-slate-200 dark:bg-slate-600">
                        {u.thumbnailUrl ? (
                          <img src={u.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-slate-400">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
                              <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                              <circle cx="9" cy="9" r="2" />
                              <polyline points="21 15 16 10 5 21" />
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Space name + status */}
                      <div className="min-w-0 flex-1">
                        <input
                          type="text"
                          value={u.spaceName}
                          onChange={(e) => renameUpload(u.localId, e.target.value)}
                          className="w-full rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-sm font-black text-slate-800 outline-none transition focus:border-slate-300 dark:text-slate-100"
                          placeholder="Nombre del espacio"
                        />
                        {u.status === 'queued' && (
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className="h-2 w-2 animate-pulse rounded-full bg-slate-300 dark:bg-slate-500" />
                            <p className="text-xs font-semibold text-slate-400">Preparando…</p>
                          </div>
                        )}
                        {u.status === 'uploading' && (
                          <div className="mt-1.5">
                            <div className="mb-1 flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Subiendo…</span>
                              <span className="text-xs font-black" style={{ color }}>{u.progress}%</span>
                            </div>
                            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-600">
                              <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{ width: `${u.progress}%`, backgroundColor: color }}
                              />
                            </div>
                          </div>
                        )}
                        {u.status === 'done' && (
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-2.5 w-2.5">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </span>
                            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                              Listo · {u.sizeMb} MB
                            </p>
                          </div>
                        )}
                        {u.status === 'error' && (
                          <div className="mt-1 flex items-start gap-1.5">
                            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-red-500 text-white">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-2.5 w-2.5">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </span>
                            <p className="text-xs font-semibold text-red-500">
                              {humanizeUploadError(u.errorMsg ?? '')}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Remove */}
                      <button
                        type="button"
                        onClick={() => removeUpload(u.localId)}
                        className="shrink-0 rounded-full p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-600"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Add more button if already have files */}
              {uploads.length > 0 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-3 text-sm font-black"
                  style={{ color }}
                >
                  + Añadir más archivos
                </button>
              )}

              {error && (
                <p className="mt-4 rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 dark:bg-red-900/20 dark:text-red-400">
                  {error}
                </p>
              )}

              <div className="mt-6 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Volver
                </button>
                <button
                  type="button"
                  onClick={() => void handleStep2()}
                  disabled={isSaving || hasUploading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 text-sm font-black text-white shadow transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  style={bgStyle}
                >
                  {isSaving ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : null}
                  {hasAnyDone ? 'Continuar' : 'Omitir por ahora'}
                  {!isSaving && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  )}
                </button>
              </div>
              {!hasAnyDone && (
                <p className="mt-2 text-center text-xs font-semibold text-slate-400">
                  Puedes subir panoramas más tarde desde la gestión de propiedades
                </p>
              )}
            </div>
          )}

          {/* ── STEP 3: Reorder ────────────────────────────────────────────── */}
          {step === 3 && (
            <div>
              <h2 className="mb-1 text-lg font-black text-slate-900 dark:text-slate-100">
                Ordena las estancias
              </h2>
              <p className="mb-6 text-sm font-semibold text-slate-500">
                Arrastra o usa las flechas para definir el recorrido. Los compradores visitarán las estancias en este orden.
              </p>

              {spaces.length === 0 ? (
                <p className="text-sm font-semibold text-slate-400">No hay estancias para ordenar.</p>
              ) : (
                <ul className="space-y-2">
                  {spaces.map((space, i) => (
                    <li
                      key={space.id}
                      className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-700/40"
                    >
                      {/* Order badge */}
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black text-white"
                        style={bgStyle}
                      >
                        {i + 1}
                      </span>

                      {/* Thumbnail */}
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-slate-200 dark:bg-slate-600">
                        {space.thumbnailUrl ? (
                          <img src={space.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-slate-400">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                              <rect width="18" height="18" x="3" y="3" rx="2" />
                              <circle cx="9" cy="9" r="2" />
                              <polyline points="21 15 16 10 5 21" />
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Editable name */}
                      <input
                        type="text"
                        value={space.name}
                        onChange={(e) => renameSpace(i, e.target.value)}
                        className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-sm font-black text-slate-800 outline-none transition focus:border-slate-300 dark:text-slate-100"
                      />

                      {/* Up/Down */}
                      <div className="flex shrink-0 flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() => moveSpace(i, -1)}
                          disabled={i === 0}
                          className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 disabled:opacity-20 dark:hover:bg-slate-600"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
                            <polyline points="18 15 12 9 6 15" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => moveSpace(i, 1)}
                          disabled={i === spaces.length - 1}
                          className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 disabled:opacity-20 dark:hover:bg-slate-600"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {error && (
                <p className="mt-4 rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 dark:bg-red-900/20 dark:text-red-400">
                  {error}
                </p>
              )}

              <div className="mt-6 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Volver
                </button>
                <button
                  type="button"
                  onClick={() => void handleStep3()}
                  disabled={isSaving}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 text-sm font-black text-white shadow transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  style={bgStyle}
                >
                  {isSaving ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : null}
                  Guardar orden
                  {!isSaving && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 4: Publish ────────────────────────────────────────────── */}
          {step === 4 && (
            <div>
              {publishedUrl ? (
                /* ─ Published state ─ */
                <div className="text-center">
                  <div
                    className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-lg"
                    style={bgStyle}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-8 w-8">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">
                    ¡Recorrido publicado!
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {title} ya está disponible para compradores
                  </p>

                  {/* Share URL */}
                  <div className="mt-6 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-600 dark:bg-slate-700">
                    <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-slate-600 dark:text-slate-300">
                      {publishedUrl}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-black transition ${
                        copied
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-200'
                      }`}
                    >
                      {copied ? '¡Copiado!' : 'Copiar'}
                    </button>
                  </div>

                  {/* Action buttons */}
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <a
                      href={publishedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                      Ver tour
                    </a>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(`¡Mira este recorrido inmersivo! ${publishedUrl}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-white hover:bg-emerald-600"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                      </svg>
                      Compartir
                    </a>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate('/properties')}
                    className="mt-4 w-full rounded-2xl border border-slate-200 py-3 text-sm font-black text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    Ir a mis propiedades
                  </button>
                </div>
              ) : (
                /* ─ Pre-publish state ─ */
                <div>
                  <h2 className="mb-1 text-lg font-black text-slate-900 dark:text-slate-100">
                    Publicar y compartir
                  </h2>
                  <p className="mb-6 text-sm font-semibold text-slate-500">
                    El recorrido está listo. Publícalo para que los compradores accedan a la experiencia.
                  </p>

                  {/* Summary card */}
                  <div className="mb-6 rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 dark:border-slate-700 dark:bg-slate-700/40">
                    <p className="text-base font-black text-slate-800 dark:text-slate-100">{title}</p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-500">
                      {PROP_TYPES.find((t) => t.value === propType)?.label ?? propType}
                      {spaces.length > 0 && ` · ${spaces.length} estancia${spaces.length !== 1 ? 's' : ''}`}
                    </p>
                    {/* Thumbnail strip */}
                    {spaces.some((s) => s.thumbnailUrl) && (
                      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                        {spaces
                          .filter((s) => s.thumbnailUrl)
                          .slice(0, 5)
                          .map((s) => (
                            <img
                              key={s.id}
                              src={s.thumbnailUrl}
                              alt={s.name}
                              className="h-16 w-24 shrink-0 rounded-xl object-cover"
                            />
                          ))}
                      </div>
                    )}
                  </div>

                  {error && (
                    <p className="mb-4 rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 dark:bg-red-900/20 dark:text-red-400">
                      {error}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => void handlePublish()}
                    disabled={isSaving}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-black text-white shadow-lg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                    style={bgStyle}
                  >
                    {isSaving ? (
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-5 w-5">
                        <path d="M22 2L11 13" />
                        <path d="M22 2L15 22 11 13 2 9l20-7z" />
                      </svg>
                    )}
                    Publicar ahora
                  </button>

                  <div className="mt-3 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setStep(spaces.length > 0 ? 3 : 2)}
                      className="flex-1 rounded-2xl border border-slate-200 py-3 text-sm font-black text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                      Volver
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/properties')}
                      className="flex-1 rounded-2xl border border-slate-200 py-3 text-sm font-black text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700"
                    >
                      Publicar más tarde
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Help hint */}
        <p className="mt-4 text-center text-xs font-semibold text-slate-400">
          Puedes editar todos los detalles después desde{' '}
          <button
            type="button"
            onClick={() => navigate('/properties')}
            className="font-black text-slate-500 underline hover:text-slate-700 dark:text-slate-400"
          >
            Mis propiedades
          </button>
        </p>
      </div>
    </div>
  );
}
