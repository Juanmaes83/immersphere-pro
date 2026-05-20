import { useState, useEffect, useRef, Suspense, lazy } from 'react';
import type { ChangeEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useBrand } from '@/hooks/useBrand';
import { api, unwrapApiResponse, getApiErrorMessage } from '@/services/api';
import { usePropertyStore } from '@/store/propertyStore';
import type { CreateAssetPayload, CreatePropertyPayload, CreateSpacePayload, UpdateSpacePayload, ImmersiveProperty } from '@/store/propertyStore';
import type { Hotspot } from '@/types/viewer';
import type { LeadRecord, UploadAssetResponse } from '@/types/api';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormInput, FormTextarea } from '@/components/ui/FormFields';
import { IcoBuilding, IcoLink, IcoWhatsApp, IcoCode, IcoFilePdf, IcoUsers, IcoCheckSm, IcoPencil } from '@/components/ui/icons';
import { formatCurrency } from '@/utils/format';

const GlbViewer = lazy(() => import('@/components/viewer/GlbViewer'));
import FloorplanPinEditor from '@/components/admin/FloorplanPinEditor';

// ─── Enum translation helpers ─────────────────────────────────────────────────
const PROPERTY_TYPE_LABELS: Record<string, string> = {
  APARTMENT: 'Apartamento',
  HOUSE: 'Casa',
  VILLA: 'Villa',
  OFFICE: 'Oficina',
  COMMERCIAL: 'Comercial'
};
function translatePropertyType(type: string): string {
  return PROPERTY_TYPE_LABELS[type] ?? type;
}

const ASSET_TYPE_LABELS: Record<string, string> = {
  panorama_360: 'Panorama 360°',
  gaussian_splat: 'Escaneo 3D',
  mesh: 'Modelo 3D'
};
function translateAssetType(type: string): string {
  return ASSET_TYPE_LABELS[type] ?? type;
}

const HOTSPOT_TYPE_LABELS: Record<string, string> = {
  info: 'Información',
  cta: 'Contacto',
  navigation: 'Navegación',
  measurement: 'Medición'
};
function translateHotspotType(type: string): string {
  return HOTSPOT_TYPE_LABELS[type] ?? type;
}

// ─── Progress & guidance system ──────────────────────────────────────────────
interface ProgressStep { label: string; ok: boolean }

function getProgressSteps(property: { title: string; spaces: Array<{ assets: unknown[] }>; status?: string }): ProgressStep[] {
  const hasSpaces = property.spaces.length > 0;
  const hasScenes = property.spaces.some((s) => (s.assets as unknown[]).length > 0);
  return [
    { label: 'Información principal', ok: Boolean(property.title) },
    { label: hasSpaces ? 'Espacios definidos' : 'Define los espacios', ok: hasSpaces },
    { label: 'Escenas inmersivas', ok: hasScenes },
    { label: 'Listo para publicar', ok: property.status === 'PUBLISHED' }
  ];
}

function getProgressPct(steps: ProgressStep[]): number {
  return Math.round((steps.filter((s) => s.ok).length / steps.length) * 100);
}

// Card chips — first 3 steps only (published shown elsewhere)
function getPropertyCompleteness(property: { title: string; spaces: Array<{ assets: unknown[] }> }): ProgressStep[] {
  return getProgressSteps(property).slice(0, 3);
}

function getNextStep(property: { title: string; spaces: Array<{ assets: Array<{ thumbnail?: string; url?: string; type?: string }> }>; status?: string }): { title: string; body: string } | null {
  const hasSpaces = property.spaces.length > 0;
  const hasScenes = property.spaces.some((s) => s.assets.length > 0);
  if (!hasSpaces) return { title: 'Define los espacios del recorrido', body: 'Cada espacio es una parada en la experiencia. Empieza por el espacio principal: el salon, la entrada o la terraza.' };
  if (!hasScenes) return { title: 'Añade las escenas de cada espacio', body: 'Sube un panorama 360° o un escaneo 3D. Los visitantes comenzaran la experiencia desde aqui.' };
  if (property.status !== 'PUBLISHED') return { title: 'El recorrido esta listo para publicarse', body: 'Todo en orden. Publícalo para que los compradores accedan a la experiencia.' };
  return null;
}

function getPropertyCover(property: { coverImage?: string | null; spaces: Array<{ assets: Array<{ thumbnail?: string | null; url?: string; type?: string }> }> }): string | null {
  if (property.coverImage) return property.coverImage;
  for (const space of property.spaces) {
    for (const asset of space.assets) {
      if (asset.thumbnail) return asset.thumbnail;
      if (asset.type === 'panorama_360' && asset.url && asset.url.startsWith('http')) return asset.url;
    }
  }
  return null;
}

export default function PropertiesPage(): JSX.Element {
  const navigate = useNavigate();
  const {
    properties,
    fetchProperties,
    createProperty,
    updateProperty,
    deleteProperty,
    createSpace,
    updateSpace,
    deleteSpace,
    createAsset,
    updateAsset,
    deleteAsset,
    isLoading,
    error
  } = usePropertyStore();

  const [form, setForm] = useState<CreatePropertyPayload>({
    title: '',
    description: '',
    type: 'APARTMENT',
    status: 'DRAFT',
    price: 0,
    area: 80,
    rooms: 2,
    bathrooms: 1,
    coverImage: '',
    panoramaUrl: '',
    floorplanUrl: '',
    address: '',
    latitude: null,
    longitude: null,
    password: '',
    language: 'es'
  });

  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);
  const [expandedPropertyId, setExpandedPropertyId] = useState<string | null>(null);
  const [editingSpace, setEditingSpace] = useState<{ propertyId: string; spaceId: string } | null>(null);
  const [editingAsset, setEditingAsset] = useState<{ propertyId: string; spaceId: string; assetId: string } | null>(null);
  const [activeAssetFormTarget, setActiveAssetFormTarget] = useState<{ propertyId: string; spaceId: string } | null>(null);
  const [spaceForm, setSpaceForm] = useState<CreateSpacePayload>({
    name: '',
    order: 1,
    status: 'ACTIVE',
    dimensions: { width: null, height: null, depth: null }
  });
  // W2+W3 extra fields — narrative, CTA, floorplan pin, audio, per-space timing
  const [spaceWowForm, setSpaceWowForm] = useState({
    storySubheadline: '',
    storyHighlight: '',
    ctaLabel: '',
    ctaSubtext: '',
    floorplanPinX: '',
    floorplanPinY: '',
    ambientAudio: '',
    guidedDuration: '10'
  });
  const [showSpaceWow, setShowSpaceWow] = useState(false);
  const [assetForm, setAssetForm] = useState<CreateAssetPayload>({
    type: 'panorama_360',
    url: '',
    thumbnail: '',
    format: 'jpg',
    size: 0,
    hotspots: []
  });
  const [selectedAssetFileName, setSelectedAssetFileName] = useState<string | null>(null);
  const [isUploadingAsset, setIsUploadingAsset] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadPhase, setUploadPhase] = useState<'idle' | 'uploading' | 'processing' | 'done'>('idle');
  const [assetPreviewUrl, setAssetPreviewUrl] = useState<string | null>(null);
  const [assetPreviewType, setAssetPreviewType] = useState<CreateAssetPayload['type'] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [leadsPropertyId, setLeadsPropertyId] = useState<string | null>(null);
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadsError, setLeadsError] = useState<string | null>(null);
  const [showHotspotForm, setShowHotspotForm] = useState(false);
  const [hotspotDraft, setHotspotDraft] = useState<{ label: string; type: Hotspot['type']; x: number; y: number; body: string; metric: string; targetSpaceId: string }>({
    label: '', type: 'info', x: 50, y: 50, body: '', metric: '', targetSpaceId: ''
  });
  const { bgStyle, colorStyle } = useBrand();

  const [copiedPropId, setCopiedPropId] = useState<string>('');
  const [copiedPropType, setCopiedPropType] = useState<string>('');
  // Visual hotspot editor: -1 = dragging draft pin, 0+ = dragging existing hotspot
  const [draggingHotspotIdx, setDraggingHotspotIdx] = useState<number | null>(null);
  // Index of the hotspot being edited (null = adding new); null | number
  const [editingHotspotIndex, setEditingHotspotIndex] = useState<number | null>(null);
  // Disclosure: show advanced asset fields (URL, thumbnail, size)
  const [showAdvancedAsset, setShowAdvancedAsset] = useState(false);
  // Used to detect click vs drag on existing pins
  const pinPointerStart = useRef<{ x: number; y: number; idx: number } | null>(null);
  const hotspotPreviewRef = useRef<HTMLDivElement>(null);

  function handleCopyProp(id: string, type: string, text: string): void {
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedPropId(id);
      setCopiedPropType(type);
      setTimeout(() => { setCopiedPropId(''); setCopiedPropType(''); }, 1800);
    });
  }

  useEffect(() => {
    void fetchProperties({ limit: 100 });
  }, [fetchProperties]);

  function resetForm(): void {
    setForm({
      title: '',
      description: '',
      type: 'APARTMENT',
      status: 'DRAFT',
      price: 0,
      area: 80,
      rooms: 2,
      bathrooms: 1,
      coverImage: '',
      panoramaUrl: '',
      floorplanUrl: '',
      address: '',
      latitude: null,
      longitude: null,
      password: '',
      language: 'es'
    });

    setEditingPropertyId(null);
    setMessage(null);
  }

  function getNextSpaceOrder(propertyId: string): number {
    const property = properties.find((item) => item.id === propertyId);
    const orders = (property?.spaces ?? []).map((space) => Number(space.order ?? 0));
    const maxOrder = orders.length > 0 ? Math.max(...orders) : 0;

    return maxOrder + 1;
  }

  function resetSpaceForm(propertyId?: string): void {
    setSpaceForm({
      name: '',
      order: propertyId ? getNextSpaceOrder(propertyId) : 1,
      status: 'ACTIVE',
      dimensions: { width: null, height: null, depth: null }
    });
    setSpaceWowForm({ storySubheadline: '', storyHighlight: '', ctaLabel: '', ctaSubtext: '', floorplanPinX: '', floorplanPinY: '', ambientAudio: '', guidedDuration: '10' });
    setShowSpaceWow(false);
    setEditingSpace(null);
  }

  function getDefaultAssetForm(): CreateAssetPayload {
    return {
      type: 'panorama_360',
      url: '',
      thumbnail: '',
      format: 'jpg',
      size: 0,
      hotspots: []
    };
  }

  function resetAssetForm(): void {
    setAssetForm(getDefaultAssetForm());
    setEditingAsset(null);
    setSelectedAssetFileName(null);
    setUploadProgress(0);
    setUploadPhase('idle');
    setAssetPreviewUrl(null);
    setAssetPreviewType(null);
    setShowHotspotForm(false);
    setHotspotDraft({ label: '', type: 'info', x: 50, y: 50, body: '', metric: '', targetSpaceId: '' });
    setEditingHotspotIndex(null);
    setShowAdvancedAsset(false);
  }

  function closeAssetForm(): void {
    resetAssetForm();
    setActiveAssetFormTarget(null);
  }

  function getDefaultAssetFormat(type: CreateAssetPayload['type']): CreateAssetPayload['format'] {
    if (type === 'gaussian_splat') return 'splat';
    if (type === 'mesh') return 'glb';

    return 'jpg';
  }

  function handleAssetTypeChange(type: CreateAssetPayload['type']): void {
    setAssetForm((current) => ({
      ...current,
      type,
      format: getDefaultAssetFormat(type)
    }));
  }

  function isFallbackAssetId(assetId: string): boolean {
    return assetId.endsWith('-fallback-panorama');
  }

  function getUploadedAssetFormat(filename: string, serverFormat: string): CreateAssetPayload['format'] {
    const ext = (serverFormat || filename.split('.').pop() || '').toLowerCase();
    const allowed: CreateAssetPayload['format'][] = ['jpg', 'jpeg', 'png', 'webp', 'splat', 'ply', 'glb'];
    return allowed.includes(ext as CreateAssetPayload['format']) ? (ext as CreateAssetPayload['format']) : 'jpg';
  }

  function getUploadedAssetType(filename: string): CreateAssetPayload['type'] {
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'glb') return 'mesh';
    if (ext === 'splat' || ext === 'ply') return 'gaussian_splat';
    return 'panorama_360';
  }

  function getUploadSizeMb(bytes: number, fallbackSize: number, fileSize: number): number {
    const raw = bytes || fallbackSize || fileSize || 0;
    return Math.round((raw / (1024 * 1024)) * 100) / 100;
  }

  async function processAssetFile(file: File): Promise<void> {
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'splat', 'ply', 'glb'];
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

    if (!allowedExtensions.includes(ext)) {
      setMessage('Formato no permitido. Usa JPG, JPEG, PNG, WEBP, SPLAT, PLY o GLB.');
      return;
    }

    if (file.size > 500 * 1024 * 1024) {
      setMessage('El archivo supera el límite de 500 MB. Comprime el archivo antes de subir (usa SuperSplat para .ply/.splat).');
      return;
    }

    setIsUploadingAsset(true);
    setUploadProgress(0);
    setUploadPhase('uploading');
    setAssetPreviewUrl(null);
    setAssetPreviewType(null);
    setMessage(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const upload = await unwrapApiResponse<UploadAssetResponse>(
        api.post('/uploads', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            const pct = progressEvent.total
              ? Math.round((progressEvent.loaded / progressEvent.total) * 90)
              : 0;
            setUploadProgress(pct);
            if (pct >= 90) setUploadPhase('processing');
          }
        })
      );

      const detectedFormat = getUploadedAssetFormat(file.name, upload.format);
      const detectedType = getUploadedAssetType(file.name);
      const sizeMb = getUploadSizeMb(upload.bytes, upload.size, file.size);

      setAssetForm((current) => ({
        ...current,
        url: upload.url,
        thumbnail: upload.thumbnailUrl || current.thumbnail || '',
        format: detectedFormat,
        type: detectedType,
        size: sizeMb
      }));

      setUploadProgress(100);
      setUploadPhase('done');
      setAssetPreviewUrl(upload.thumbnailUrl || upload.url || null);
      setAssetPreviewType(detectedType);
      setSelectedAssetFileName(upload.originalName || file.name);
      setMessage('Archivo subido correctamente. Revisa y guarda la escena.');
    } catch (error) {
      setUploadPhase('idle');
      setUploadProgress(0);
      setMessage(getApiErrorMessage(error));
    } finally {
      setIsUploadingAsset(false);
    }
  }

  async function handleAssetFileUpload(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    await processAssetFile(file);
  }

  async function handleViewLeads(propertyId: string): Promise<void> {
    if (leadsPropertyId === propertyId) {
      setLeadsPropertyId(null);
      setLeads([]);
      return;
    }
    setLeadsPropertyId(propertyId);
    setLeadsLoading(true);
    setLeadsError(null);
    try {
      const data = await unwrapApiResponse<LeadRecord[]>(api.get(`/leads/properties/${propertyId}`));
      setLeads(Array.isArray(data) ? data : []);
    } catch (err) {
      setLeadsError(getApiErrorMessage(err));
    } finally {
      setLeadsLoading(false);
    }
  }

  async function handleExportLeadsCsv(propertyId: string, title: string): Promise<void> {
    try {
      const response = await api.get(`/leads/properties/${propertyId}/export.csv`, { responseType: 'text' });
      const blob = new Blob([response.data as string], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `leads-${title.replace(/\s+/g, '-').toLowerCase()}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setMessage('No se pudo exportar los leads.');
    }
  }

  function handleAddHotspot(): void {
    if (!hotspotDraft.label.trim()) return;
    if (hotspotDraft.type === 'navigation' && !hotspotDraft.targetSpaceId) return;
    const newHotspot: Hotspot = {
      id: `draft-${Date.now()}`,
      label: hotspotDraft.label.trim(),
      type: hotspotDraft.type,
      position: { x: hotspotDraft.x, y: hotspotDraft.y },
      body: hotspotDraft.body.trim(),
      metric: hotspotDraft.metric.trim(),
      ...(hotspotDraft.targetSpaceId ? { targetSpaceId: hotspotDraft.targetSpaceId } : {})
    };
    setAssetForm((current) => ({ ...current, hotspots: [...(current.hotspots ?? []), newHotspot] }));
    setHotspotDraft({ label: '', type: 'info', x: 50, y: 50, body: '', metric: '', targetSpaceId: '' });
    setShowHotspotForm(false);
  }

  function handleRemoveHotspot(index: number): void {
    setAssetForm((current) => ({
      ...current,
      hotspots: (current.hotspots ?? []).filter((_, i) => i !== index)
    }));
    // If editing this hotspot, cancel edit mode too
    if (editingHotspotIndex === index) {
      setEditingHotspotIndex(null);
      setHotspotDraft({ label: '', type: 'info', x: 50, y: 50, body: '', metric: '', targetSpaceId: '' });
      setShowHotspotForm(false);
    }
  }

  function handleEditHotspot(index: number): void {
    const hotspot = (assetForm.hotspots ?? [])[index];
    if (!hotspot) return;
    setHotspotDraft({
      label: hotspot.label,
      type: hotspot.type,
      x: hotspot.position.x,
      y: hotspot.position.y,
      body: hotspot.body ?? '',
      metric: hotspot.metric ?? '',
      targetSpaceId: hotspot.targetSpaceId ?? ''
    });
    setEditingHotspotIndex(index);
    setShowHotspotForm(true);
  }

  function handleSaveHotspotEdit(): void {
    if (editingHotspotIndex === null) return;
    if (!hotspotDraft.label.trim()) return;
    if (hotspotDraft.type === 'navigation' && !hotspotDraft.targetSpaceId) return;
    setAssetForm((current) => ({
      ...current,
      hotspots: (current.hotspots ?? []).map((h, i) =>
        i === editingHotspotIndex
          ? {
              ...h,
              label: hotspotDraft.label.trim(),
              type: hotspotDraft.type,
              position: { x: hotspotDraft.x, y: hotspotDraft.y },
              body: hotspotDraft.body.trim(),
              metric: hotspotDraft.metric.trim(),
              targetSpaceId: hotspotDraft.targetSpaceId || undefined
            }
          : h
      )
    }));
    setEditingHotspotIndex(null);
    setHotspotDraft({ label: '', type: 'info', x: 50, y: 50, body: '', metric: '', targetSpaceId: '' });
    setShowHotspotForm(false);
  }

  function buildPayload(): CreatePropertyPayload {
    return {
      title: String(form.title ?? '').trim(),
      description: String(form.description ?? '').trim(),
      type: String(form.type ?? 'APARTMENT'),
      status: String(form.status ?? 'DRAFT'),
      price: Number(form.price ?? 0),
      area: Number(form.area ?? 0),
      rooms: Number(form.rooms ?? 0),
      bathrooms: Number(form.bathrooms ?? 0),
      coverImage: String(form.coverImage ?? '').trim(),
      panoramaUrl: String(form.panoramaUrl ?? '').trim(),
      floorplanUrl: String(form.floorplanUrl ?? '').trim(),
      address: String(form.address ?? '').trim(),
      latitude: form.latitude ?? null,
      longitude: form.longitude ?? null,
      language: String(form.language ?? 'es'),
      ...(form.password ? { password: form.password } : {})
    };
  }

  function handleEditProperty(property: any): void {
    setEditingPropertyId(property.id);

    setForm({
      title: property.title ?? '',
      description: property.description ?? '',
      type: property.type ?? 'APARTMENT',
      status: property.status ?? 'DRAFT',
      price: property.price ?? 0,
      area: property.area ?? 80,
      rooms: property.rooms ?? 0,
      bathrooms: property.bathrooms ?? 0,
      coverImage: property.coverImage ?? '',
      panoramaUrl: property.panoramaUrl ?? '',
      floorplanUrl: property.floorplanUrl ?? '',
      address: property.address ?? '',
      latitude: property.latitude ?? null,
      longitude: property.longitude ?? null,
      language: property.language ?? 'es'
    });

    setMessage('Editando propiedad seleccionada.');
  }

  async function handleSubmit(event: any): Promise<void> {
    event.preventDefault();
    setMessage(null);

    const payload = buildPayload();

    if (payload.title.length < 2) {
      setMessage('El titulo debe tener al menos 2 caracteres.');
      return;
    }

    if (!editingPropertyId && (payload.area ?? 0) <= 0) {
      setMessage('La superficie debe ser mayor que 0 m2.');
      return;
    }

    try {
      if (editingPropertyId) {
        await updateProperty(editingPropertyId, payload);
        setMessage('Propiedad actualizada correctamente.');
      } else {
        await createProperty(payload);
        setMessage('Propiedad creada correctamente.');
      }

      resetForm();
      await fetchProperties({ limit: 100 });
    } catch {
      setMessage('No se ha podido guardar la propiedad.');
    }
  }

  async function handleTogglePublish(property: any): Promise<void> {
    const nextStatus = property.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';

    try {
      await updateProperty(property.id, {
        title: property.title,
        description: property.description,
        type: property.type,
        status: nextStatus,
        price: property.price,
        area: property.area,
        rooms: property.rooms,
        bathrooms: property.bathrooms,
        coverImage: property.coverImage,
        panoramaUrl: property.panoramaUrl,
        address: property.address ?? '',
        latitude: property.latitude ?? null,
        longitude: property.longitude ?? null
      });

      setMessage(
        nextStatus === 'PUBLISHED'
          ? 'Propiedad publicada. Ya aparece en Galeria.'
          : 'Propiedad despublicada. Ya no aparece en Galeria.'
      );

      await fetchProperties({ limit: 100 });
    } catch {
      setMessage('No se ha podido cambiar el estado de publicacion.');
    }
  }

  async function handleDeleteProperty(propertyId: string): Promise<void> {
    try {
      await deleteProperty(propertyId);

      if (editingPropertyId === propertyId) {
        resetForm();
      }

      setMessage('Propiedad eliminada correctamente.');
      await fetchProperties({ limit: 100 });
    } catch {
      setMessage('No se ha podido eliminar la propiedad.');
    }
  }

  function handleOpenSpaces(property: ImmersiveProperty): void {
    const nextIsOpen = expandedPropertyId !== property.id;
    setExpandedPropertyId(nextIsOpen ? property.id : null);
    setEditingSpace(null);

    setSpaceForm({
      name: '',
      order: (property.spaces?.length ?? 0) + 1,
      status: 'ACTIVE',
      dimensions: { width: null, height: null, depth: null }
    });

    if (nextIsOpen) {
      setMessage('Gestionando estancias de ' + property.title + '.');
    }
  }

  function handleEditSpace(propertyId: string, space: ImmersiveProperty['spaces'][number]): void {
    setExpandedPropertyId(propertyId);
    setEditingSpace({ propertyId, spaceId: space.id });

    setSpaceForm({
      name: space.name,
      order: space.order,
      status: space.status,
      dimensions: space.dimensions ?? { width: null, height: null, depth: null }
    });
    setSpaceWowForm({
      storySubheadline: space.storySubheadline ?? '',
      storyHighlight:   space.storyHighlight ?? '',
      ctaLabel:         space.ctaLabel ?? '',
      ctaSubtext:       space.ctaSubtext ?? '',
      floorplanPinX:    space.floorplanPin?.x != null ? String(space.floorplanPin.x) : '',
      floorplanPinY:    space.floorplanPin?.y != null ? String(space.floorplanPin.y) : '',
      ambientAudio:     space.ambientAudio ?? '',
      guidedDuration:   String(space.guidedDuration ?? 10)
    });
    setShowSpaceWow(
      !!(space.storySubheadline || space.storyHighlight || space.ctaLabel || space.ctaSubtext || space.floorplanPin)
    );

    setMessage('Editando estancia seleccionada.');
  }

  async function handleSubmitSpace(event: any, propertyId: string): Promise<void> {
    event.preventDefault();
    setMessage(null);

    const payload: CreateSpacePayload = {
      name: String(spaceForm.name ?? '').trim(),
      order: Math.max(1, Number(spaceForm.order ?? 1)),
      status: spaceForm.status === 'HIDDEN' ? 'HIDDEN' : 'ACTIVE',
      dimensions: spaceForm.dimensions ?? { width: null, height: null, depth: null }
    };

    if (payload.name.length < 1) {
      setMessage('La estancia necesita nombre.');
      return;
    }

    // W2 narrative + CTA + floorplan pin extras
    const wowExtras: Record<string, unknown> = {};
    if (spaceWowForm.storySubheadline.trim()) wowExtras['storySubheadline'] = spaceWowForm.storySubheadline.trim();
    if (spaceWowForm.storyHighlight.trim())   wowExtras['storyHighlight']   = spaceWowForm.storyHighlight.trim();
    if (spaceWowForm.ctaLabel.trim())         wowExtras['ctaLabel']         = spaceWowForm.ctaLabel.trim();
    if (spaceWowForm.ctaSubtext.trim())       wowExtras['ctaSubtext']       = spaceWowForm.ctaSubtext.trim();
    const pinX = parseFloat(spaceWowForm.floorplanPinX);
    const pinY = parseFloat(spaceWowForm.floorplanPinY);
    if (!isNaN(pinX) && !isNaN(pinY)) {
      wowExtras['floorplanPin'] = { x: Math.max(0, Math.min(100, pinX)), y: Math.max(0, Math.min(100, pinY)) };
    }
    if (spaceWowForm.ambientAudio.trim()) wowExtras['ambientAudio'] = spaceWowForm.ambientAudio.trim();
    const parsedDuration = parseInt(spaceWowForm.guidedDuration, 10);
    if (!isNaN(parsedDuration) && parsedDuration > 0) wowExtras['guidedDuration'] = parsedDuration;

    try {
      if (editingSpace && editingSpace.propertyId === propertyId) {
        await updateSpace(propertyId, editingSpace.spaceId, { ...payload, ...wowExtras } as UpdateSpacePayload);
        setMessage('Estancia actualizada correctamente.');
      } else {
        await createSpace(propertyId, { ...payload, ...wowExtras } as CreateSpacePayload);
        setMessage('Estancia creada correctamente.');
      }

      resetSpaceForm(propertyId);
      setExpandedPropertyId(propertyId);
      await fetchProperties({ limit: 100 });
    } catch {
      setMessage('No se ha podido guardar la estancia.');
    }
  }

  async function handleToggleSpaceStatus(propertyId: string, space: ImmersiveProperty['spaces'][number]): Promise<void> {
    const nextStatus = space.status === 'HIDDEN' ? 'ACTIVE' : 'HIDDEN';

    try {
      await updateSpace(propertyId, space.id, { status: nextStatus });
      setMessage(nextStatus === 'HIDDEN' ? 'Estancia ocultada.' : 'Estancia activada.');
      await fetchProperties({ limit: 100 });
    } catch {
      setMessage('No se ha podido cambiar el estado de la estancia.');
    }
  }

  async function handleDeleteSpace(propertyId: string, spaceId: string): Promise<void> {
    try {
      await deleteSpace(propertyId, spaceId);

      if (editingSpace?.spaceId === spaceId) {
        resetSpaceForm(propertyId);
      }

      setExpandedPropertyId(propertyId);
      setMessage('Estancia eliminada correctamente.');
      await fetchProperties({ limit: 100 });
    } catch {
      setMessage('No se ha podido eliminar la estancia.');
    }
  }

  function handleOpenAssetForm(propertyId: string, spaceId: string): void {
    setActiveAssetFormTarget({ propertyId, spaceId });
    setEditingAsset(null);
    setAssetForm(getDefaultAssetForm());
    setMessage('Preparando nueva escena para la estancia.');
  }

  function handleEditAsset(
    propertyId: string,
    spaceId: string,
    asset: ImmersiveProperty['spaces'][number]['assets'][number]
  ): void {
    setActiveAssetFormTarget({ propertyId, spaceId });
    setAssetPreviewUrl(null);
    setAssetPreviewType(null);
    setUploadPhase('idle');
    setUploadProgress(0);
    setSelectedAssetFileName(null);

    if (isFallbackAssetId(asset.id)) {
      setEditingAsset(null);
      setAssetForm(getDefaultAssetForm());
      setMessage('Esta escena es demo temporal. Crea una real para sustituirla.');
      return;
    }

    setEditingAsset({ propertyId, spaceId, assetId: asset.id });
    setAssetForm({
      type: asset.type,
      url: asset.url,
      thumbnail: asset.thumbnail ?? '',
      format: asset.format,
      size: asset.size ?? 0,
      hotspots: asset.hotspots ?? []
    });
    // Show existing thumbnail as preview if available
    if (asset.thumbnail) {
      setAssetPreviewUrl(asset.thumbnail);
      setAssetPreviewType(asset.type);
      setUploadPhase('done');
    }
    setMessage('Editando escena seleccionada.');
    setShowAdvancedAsset(true); // show URL/thumbnail when editing existing
  }

  async function handleSubmitAsset(event: any, propertyId: string, spaceId: string): Promise<void> {
    event.preventDefault();
    setMessage(null);

    const payload: CreateAssetPayload = {
      type: assetForm.type,
      url: String(assetForm.url ?? '').trim(),
      thumbnail: String(assetForm.thumbnail ?? '').trim(),
      format: assetForm.format,
      size: Math.round(Math.max(0, Number(assetForm.size ?? 0))),
      hotspots: assetForm.hotspots ?? []
    };

    if (payload.url.length < 1) {
      setMessage('La escena necesita una URL.');
      return;
    }

    try {
      if (editingAsset && editingAsset.propertyId === propertyId && editingAsset.spaceId === spaceId) {
        await updateAsset(propertyId, spaceId, editingAsset.assetId, payload);
        setMessage('Escena actualizada correctamente.');
      } else {
        await createAsset(propertyId, spaceId, payload);
        setMessage('Escena creada correctamente.');
      }

      closeAssetForm();
      setExpandedPropertyId(propertyId);
      await fetchProperties({ limit: 100 });
    } catch {
      setMessage('No se ha podido guardar la escena.');
    }
  }

  async function handleDeleteAsset(propertyId: string, spaceId: string, assetId: string): Promise<void> {
    if (isFallbackAssetId(assetId)) {
      setMessage('No se puede eliminar la escena demo temporal. Crea una real para sustituirla.');
      return;
    }

    try {
      await deleteAsset(propertyId, spaceId, assetId);

      if (editingAsset?.assetId === assetId) {
        closeAssetForm();
      }

      setExpandedPropertyId(propertyId);
      setMessage('Escena eliminada correctamente.');
      await fetchProperties({ limit: 100 });
    } catch {
      setMessage('No se ha podido eliminar la escena.');
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-10">
      <p className="text-sm font-black uppercase tracking-[0.22em]" style={colorStyle}>Mis propiedades</p>
      <h1 className="mt-3 text-5xl font-black tracking-tight">Propiedades</h1>

      {/* ── Quick-start wizard banner ───────────────────────────────────────── */}
      {!editingPropertyId && (
        <Link
          to="/properties/new"
          className="mt-6 flex items-center gap-4 rounded-[1.5rem] border border-slate-200 bg-white px-6 py-4 shadow-sm transition hover:shadow-md dark:border-slate-700 dark:bg-slate-800"
        >
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow"
            style={bgStyle}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-5 w-5">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-black text-slate-900 dark:text-slate-100">
              Crear nuevo recorrido
            </span>
            <span className="block text-xs font-semibold text-slate-500">
              Wizard guiado · sube panoramas · publica en menos de 15 min
            </span>
          </span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-5 w-5 shrink-0 text-slate-400">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
      )}

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[420px_1fr]">
        <form onSubmit={handleSubmit} className="rounded-[1.8rem] bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-2xl font-black">{editingPropertyId ? 'Editar propiedad' : 'Crear recorrido'}</h2>

            {editingPropertyId ? (
              <button type="button" onClick={resetForm} className="rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-200">
                Cancelar
              </button>
            ) : null}
          </div>

          <FormInput label="Título" value={form.title ?? ''} onChange={(value) => setForm((current) => ({ ...current, title: value }))} />
          <FormTextarea label="Descripción" value={form.description ?? ''} onChange={(value) => setForm((current) => ({ ...current, description: value }))} />

          <div className="grid grid-cols-2 gap-3">
            <label className="mt-4 block">
              <span className="mb-2 block text-sm font-black text-slate-700">Tipo</span>
              <select
                value={form.type ?? 'APARTMENT'}
                onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-violet-400"
              >
                <option value="APARTMENT">Apartamento</option>
                <option value="HOUSE">Casa</option>
                <option value="VILLA">Villa</option>
                <option value="OFFICE">Oficina</option>
                <option value="COMMERCIAL">Comercial</option>
              </select>
            </label>

            <label className="mt-4 block">
              <span className="mb-2 block text-sm font-black text-slate-700">Estado</span>
              <select
                value={form.status ?? 'DRAFT'}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-violet-400"
              >
                <option value="DRAFT">Borrador</option>
                <option value="PUBLISHED">Publicado</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormInput label="Precio" type="number" value={String(form.price ?? 0)} onChange={(value) => setForm((current) => ({ ...current, price: Number(value) }))} />
            <FormInput label="m2" type="number" value={String(form.area ?? 0)} onChange={(value) => setForm((current) => ({ ...current, area: Number(value) }))} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormInput label="Habitaciones" type="number" value={String(form.rooms ?? 0)} onChange={(value) => setForm((current) => ({ ...current, rooms: Number(value) }))} />
            <FormInput label="Baños" type="number" value={String(form.bathrooms ?? 0)} onChange={(value) => setForm((current) => ({ ...current, bathrooms: Number(value) }))} />
          </div>
          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-black text-slate-700">
              Imagen de portada <span className="font-semibold text-slate-400">(opcional)</span>
            </span>
            <input
              type="text"
              value={form.coverImage ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, coverImage: event.target.value }))}
              placeholder="https://... imagen de portada o miniatura"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-violet-400"
            />
          </label>

          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-black text-slate-700">
              URL panorama 360 <span className="font-semibold text-slate-400">(opcional)</span>
            </span>
            <input
              type="text"
              value={form.panoramaUrl ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, panoramaUrl: event.target.value }))}
              placeholder="/demo/panorama-living-room.jpg"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-violet-400"
            />
          </label>

          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-black text-slate-700">
              URL plano de planta <span className="font-semibold text-slate-400">(opcional — activa la vista de plano interactivo)</span>
            </span>
            <input
              type="text"
              value={form.floorplanUrl ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, floorplanUrl: event.target.value }))}
              placeholder="https://res.cloudinary.com/.../plano.jpg"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-violet-400"
            />
          </label>

          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-black text-slate-700">
              Dirección <span className="font-semibold text-slate-400">(opcional)</span>
            </span>
            <input
              type="text"
              value={form.address ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
              placeholder="Calle Mayor 1, Madrid"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-violet-400"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="mt-4 block">
              <span className="mb-2 block text-sm font-black text-slate-700">
                Latitud <span className="font-semibold text-slate-400">(opcional)</span>
              </span>
              <input
                type="number"
                step="any"
                value={form.latitude ?? ''}
                onChange={(event) => setForm((current) => ({ ...current, latitude: event.target.value !== '' ? Number(event.target.value) : null }))}
                placeholder="40.4168"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-violet-400"
              />
            </label>
            <label className="mt-4 block">
              <span className="mb-2 block text-sm font-black text-slate-700">
                Longitud <span className="font-semibold text-slate-400">(opcional)</span>
              </span>
              <input
                type="number"
                step="any"
                value={form.longitude ?? ''}
                onChange={(event) => setForm((current) => ({ ...current, longitude: event.target.value !== '' ? Number(event.target.value) : null }))}
                placeholder="-3.7038"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-violet-400"
              />
            </label>
          </div>

          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-black text-slate-700">
              Contraseña del tour <span className="font-semibold text-slate-400">(opcional – deja vacío para acceso libre)</span>
            </span>
            <input
              type="password"
              value={form.password ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              placeholder="Contraseña para proteger el tour"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-violet-400"
            />
          </label>

          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-black text-slate-700">
              Idioma del visor <span className="font-semibold text-slate-400">(interfaz del tour para el comprador)</span>
            </span>
            <select
              value={form.language ?? 'es'}
              onChange={(event) => setForm((current) => ({ ...current, language: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-violet-400"
            >
              <option value="es">🇪🇸 Español</option>
              <option value="en">🇬🇧 English</option>
            </select>
          </label>

          {error ? <div className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div> : null}
          {message ? <div className="mt-4 rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</div> : null}

          <button disabled={isLoading} type="submit" className="mt-7 w-full rounded-2xl px-5 py-4 text-sm font-black text-white transition hover:opacity-90 disabled:opacity-60" style={bgStyle}>
            {isLoading ? 'Guardando...' : editingPropertyId ? 'Guardar cambios' : 'Crear propiedad'}
          </button>
        </form>

        <section className="space-y-4">
          {!isLoading && properties.length === 0 ? (
            <EmptyState
              icon={IcoBuilding}
              title="Tu primer recorrido inmersivo"
              body="Crea una propiedad, define sus espacios y sube las escenas. Los compradores podran explorarla como si estuvieran dentro."
            />
          ) : null}
          {properties.map((property) => {
            const cover = getPropertyCover(property);
            return (
            <article key={property.id} className="overflow-hidden rounded-[1.75rem] bg-white shadow-sm ring-1 ring-slate-200/80 transition-shadow duration-300 hover:shadow-md">

              {/* ── Cinematic hero ── */}
              <div className="relative h-44 overflow-hidden bg-slate-950 sm:h-56">
                {cover ? (
                  <img
                    src={cover}
                    alt=""
                    className="h-full w-full object-cover opacity-90 transition-transform duration-700 group-hover:scale-[1.03]"
                  />
                ) : (
                  /* Synthetic hero: brand gradient + initials watermark */
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-violet-700 via-fuchsia-700 to-violet-900">
                    <span className="select-none text-7xl font-black tracking-tighter text-white/10">
                      {property.title.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                )}

                {/* Cinematic overlay: transparent top → slate-950/85 bottom */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/88 via-slate-950/30 to-transparent" />

                {/* Top-right: status badge only */}
                <div className="absolute right-4 top-4">
                  <span className={`rounded-full px-3 py-1 text-[10px] font-black backdrop-blur-sm ${
                    property.status === 'PUBLISHED'
                      ? 'bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-400/30'
                      : 'bg-black/30 text-white/55 ring-1 ring-white/15'
                  }`}>
                    {property.status === 'PUBLISHED' ? 'Publicado' : 'Borrador'}
                  </span>
                </div>

                {/* Bottom: editorial title block */}
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">
                    {translatePropertyType(property.type)}
                  </p>
                  <h3 className="mt-2 text-2xl font-black leading-tight tracking-tight text-white">
                    {property.title}
                  </h3>
                  <div className="mt-2 flex items-baseline gap-3">
                    <span className="text-base font-black tracking-tight text-white">
                      {formatCurrency(property.price)}
                    </span>
                    <span className="text-xs font-semibold text-white/45">
                      {property.area} m²
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-5">
              {/* ── Completeness chips ── */}
              <div className="flex flex-wrap gap-2">
                {getPropertyCompleteness(property).map((item) => (
                  <span
                    key={item.label}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                      item.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-600'
                    }`}
                  >
                    <span>{item.ok ? '✓' : '⚠'}</span>
                    {item.label}
                  </span>
                ))}
              </div>

              {/* ── Actions ── */}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {/* Primary CTA */}
                <button
                  type="button"
                  onClick={() => navigate(`/property/${property.id}`)}
                  className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-black text-white transition-opacity hover:opacity-90"
                  style={bgStyle}
                >
                  Explorar recorrido <span aria-hidden="true" className="opacity-70">&#8594;</span>
                </button>

                {/* Secondary: design flow */}
                <button
                  type="button"
                  onClick={() => handleOpenSpaces(property)}
                  className="rounded-full border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-black text-violet-700 transition-colors hover:bg-violet-100"
                >
                  {property.spaces.length === 0 ? 'Crear recorrido' : 'Diseñar'}
                </button>

                {/* Publish toggle */}
                <button
                  type="button"
                  onClick={() => void handleTogglePublish(property)}
                  className={`rounded-full px-4 py-2.5 text-sm font-black transition-colors ${
                    property.status === 'PUBLISHED'
                      ? 'border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'
                      : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  }`}
                >
                  {property.status === 'PUBLISHED' ? 'Despublicar' : 'Publicar'}
                </button>

                {/* Delete — minimal, pushed right */}
                <button
                  type="button"
                  onClick={() => void handleDeleteProperty(property.id)}
                  className="ml-auto rounded-full px-3 py-2 text-sm font-black text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                  title="Eliminar propiedad"
                >
                  ×
                </button>
              </div>

              {/* ── Quick actions footer ── */}
              <div className="mt-3 flex items-center gap-0 border-t border-slate-100 pt-3">
                {/* Leads count — left, visible */}
                <button
                  type="button"
                  title="Ver leads"
                  onClick={(e) => { e.stopPropagation(); void handleViewLeads(property.id); }}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                    leadsPropertyId === property.id
                      ? 'bg-slate-950 text-white'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                  }`}
                >
                  {IcoUsers}
                  <span>{property.leads} lead{property.leads !== 1 ? 's' : ''}</span>
                </button>

                {/* Icon-only strip — right */}
                <div className="ml-auto flex items-center gap-1">
                  {/* Edit datos */}
                  <button type="button" title="Editar datos" onClick={(e) => { e.stopPropagation(); handleEditProperty(property); }} className="rounded-xl p-2.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                    {IcoPencil}
                  </button>
                  {/* Separator */}
                  <span aria-hidden="true" className="mx-1.5 h-3.5 w-px self-center bg-slate-900/10" />
                  {/* Compartir */}
                  <button type="button" title="Copiar link publico" onClick={(e) => { e.stopPropagation(); handleCopyProp(property.id, 'link', `${window.location.origin}/property/${property.id}`); }} className="rounded-xl p-2.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                    {copiedPropId === property.id && copiedPropType === 'link' ? IcoCheckSm : IcoLink}
                  </button>
                  <button type="button" title="Compartir por WhatsApp" onClick={(e) => { e.stopPropagation(); window.open(`https://wa.me/?text=${encodeURIComponent(`Te paso el recorrido inmersivo de ${property.title}. Puedes verlo como si estuvieras dentro de la vivienda: ${window.location.origin}/property/${property.id}`)}`, '_blank'); }} className="rounded-xl p-2.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                    {IcoWhatsApp}
                  </button>
                  {/* Separator */}
                  <span aria-hidden="true" className="mx-1.5 h-3.5 w-px self-center bg-slate-900/10" />
                  {/* Tecnico */}
                  <button type="button" title="Copiar embed" onClick={(e) => { e.stopPropagation(); handleCopyProp(property.id, 'embed', `<iframe src="${window.location.origin}/embed/${property.id}" width="100%" height="600" frameborder="0" allowfullscreen></iframe>`); }} className="rounded-xl p-2.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                    {copiedPropId === property.id && copiedPropType === 'embed' ? IcoCheckSm : IcoCode}
                  </button>
                  <button type="button" title="Descargar PDF" onClick={(e) => { e.stopPropagation(); window.open(`/api/properties/${property.id}/report.pdf`, '_blank'); }} className="rounded-xl p-2.5 text-slate-400 opacity-60 transition hover:bg-slate-100 hover:text-slate-700 hover:opacity-100">
                    {IcoFilePdf}
                  </button>
                </div>
              </div>

              {expandedPropertyId === property.id ? (() => {
                const steps = getProgressSteps(property);
                const pct = getProgressPct(steps);
                const nextStep = getNextStep(property);
                return (
                <div className="mt-5 overflow-hidden rounded-[1.25rem] border border-violet-100 bg-violet-50/60">
                  {/* ── A. Sticky progress header ── */}
                  <div className="sticky top-2 z-10 mx-3 mt-3 rounded-2xl border border-white/80 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex flex-wrap gap-2">
                        {steps.map((step) => (
                          <span key={step.label} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black ${
                            step.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'
                          }`}>
                            {step.ok ? '✓' : '○'} {step.label}
                          </span>
                        ))}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-black leading-none text-slate-950">{pct}%</p>
                        <p className="text-[10px] font-semibold text-slate-400">completado</p>
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* ── B. Siguiente paso contextual ── */}
                  <div className="mx-3 mt-3">
                    {nextStep ? (
                      <div className="rounded-2xl border border-violet-200/60 bg-violet-50/80 px-4 py-3">
                        <p className="text-sm font-black text-violet-900">{nextStep.title}</p>
                        <p className="mt-1 text-xs font-bold text-violet-700/70">{nextStep.body}</p>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50 px-4 py-3">
                        <p className="text-sm font-black text-emerald-800">Recorrido completo y publicado</p>
                        <p className="mt-1 text-xs font-bold text-emerald-700/60">Los compradores pueden acceder al tour inmersivo ahora mismo.</p>
                      </div>
                    )}
                  </div>

                  <div className="p-4">
                  <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h4 className="text-lg font-black text-slate-950">Construir experiencia</h4>
                      <p className="text-sm font-semibold text-slate-500">Define los espacios y añade las escenas para construir la experiencia.</p>
                    </div>
                    <button type="button" onClick={() => resetSpaceForm(property.id)} className="rounded-full bg-white px-4 py-2 text-sm font-black text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
                      Nueva estancia
                    </button>
                  </div>

                  <form onSubmit={(event) => void handleSubmitSpace(event, property.id)} className="grid grid-cols-1 gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200 md:grid-cols-[1fr_110px_140px_auto] md:items-end">
                    <FormInput label="Nombre estancia" value={spaceForm.name ?? ''} onChange={(value) => setSpaceForm((current) => ({ ...current, name: value }))} />
                    <FormInput label="Orden" type="number" value={String(spaceForm.order ?? 1)} onChange={(value) => setSpaceForm((current) => ({ ...current, order: Number(value) }))} />

                    <label className="mt-4 block">
                      <span className="mb-2 block text-sm font-black text-slate-700">Estado</span>
                      <select
                        value={spaceForm.status ?? 'ACTIVE'}
                        onChange={(event) => setSpaceForm((current) => ({ ...current, status: event.target.value as CreateSpacePayload['status'] }))}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-violet-400"
                      >
                        <option value="ACTIVE">Activa</option>
                        <option value="HIDDEN">Oculta</option>
                      </select>
                    </label>

                    <button disabled={isLoading} type="submit" className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-violet-700 disabled:opacity-60">
                      {editingSpace?.propertyId === property.id ? 'Guardar estancia' : 'Crear estancia'}
                    </button>

                    {/* ── W2: Narrativa · CTA · Plano ──────────────────────── */}
                    <div className="md:col-span-4 border-t border-slate-100 pt-3 mt-1">
                      <button
                        type="button"
                        onClick={() => { setShowSpaceWow((v) => !v); }}
                        className="flex w-full items-center justify-between text-[0.68rem] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-violet-600"
                      >
                        <span>Narrativa · CTA · Plano</span>
                        <span className="text-xs">{showSpaceWow ? '▲' : '▼'}</span>
                      </button>

                      {showSpaceWow ? (
                        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                          <label className="block">
                            <span className="mb-1.5 block text-xs font-black text-slate-600">Titular editorial</span>
                            <input
                              type="text"
                              value={spaceWowForm.storySubheadline}
                              onChange={(e) => { setSpaceWowForm((f) => ({ ...f, storySubheadline: e.target.value })); }}
                              placeholder="La luz entra desde primera hora"
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold outline-none focus:border-violet-400"
                            />
                          </label>
                          <label className="block">
                            <span className="mb-1.5 block text-xs font-black text-slate-600">Microcaption</span>
                            <input
                              type="text"
                              value={spaceWowForm.storyHighlight}
                              onChange={(e) => { setSpaceWowForm((f) => ({ ...f, storyHighlight: e.target.value })); }}
                              placeholder="Diseñado para vivir y compartir"
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold outline-none focus:border-violet-400"
                            />
                          </label>
                          <label className="block">
                            <span className="mb-1.5 block text-xs font-black text-slate-600">CTA del espacio</span>
                            <input
                              type="text"
                              value={spaceWowForm.ctaLabel}
                              onChange={(e) => { setSpaceWowForm((f) => ({ ...f, ctaLabel: e.target.value })); }}
                              placeholder="Solicitar visita"
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold outline-none focus:border-violet-400"
                            />
                          </label>
                          <label className="block">
                            <span className="mb-1.5 block text-xs font-black text-slate-600">Subtexto CTA</span>
                            <input
                              type="text"
                              value={spaceWowForm.ctaSubtext}
                              onChange={(e) => { setSpaceWowForm((f) => ({ ...f, ctaSubtext: e.target.value })); }}
                              placeholder="Sin compromiso · respuesta 24h"
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold outline-none focus:border-violet-400"
                            />
                          </label>
                          <FloorplanPinEditor
                            floorplanUrl={property.floorplanUrl ?? ''}
                            pinX={spaceWowForm.floorplanPinX}
                            pinY={spaceWowForm.floorplanPinY}
                            spaceName={spaceForm.name ?? ''}
                            onChange={(x, y) => {
                              setSpaceWowForm((f) => ({ ...f, floorplanPinX: x, floorplanPinY: y }));
                            }}
                          />
                          {/* Audio + Guided Duration */}
                          <label className="block">
                            <span className="mb-1 block text-xs font-black uppercase tracking-widest text-slate-400">Audio ambiente (URL MP3)</span>
                            <input
                              type="text"
                              value={spaceWowForm.ambientAudio}
                              onChange={(e) => { setSpaceWowForm((f) => ({ ...f, ambientAudio: e.target.value })); }}
                              placeholder="https://cdn.ejemplo.com/audio/salon.mp3"
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold outline-none focus:border-violet-400"
                            />
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-xs font-black uppercase tracking-widest text-slate-400">Duracion tour guiado (segundos)</span>
                            <input
                              type="number"
                              min={3}
                              max={60}
                              value={spaceWowForm.guidedDuration}
                              onChange={(e) => { setSpaceWowForm((f) => ({ ...f, guidedDuration: e.target.value })); }}
                              className="w-32 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold outline-none focus:border-violet-400"
                            />
                          </label>
                        </div>
                      ) : null}
                    </div>
                  </form>

                  <div className="mt-4 grid grid-cols-1 gap-3">
                    {property.spaces.length === 0 ? (
                      <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
                        <p className="text-sm font-black text-slate-800">Define los espacios del recorrido</p>
                        <p className="mt-1 text-xs font-semibold text-slate-400">Cada espacio es una parada en la experiencia. Empieza por el espacio principal: el salon, la entrada o la terraza.</p>
                      </div>
                    ) : (
                      property.spaces.map((space) => (
                        <div key={space.id} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                              <p className="mb-2 text-base font-black text-slate-950">{space.name}</p>
                              <div className="flex flex-wrap gap-2">
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">Orden {space.order}</span>
                                <span className={space.status === 'HIDDEN' ? 'rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700' : 'rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700'}>
                                  {space.status === 'HIDDEN' ? 'Oculta' : 'Activa'}
                                </span>
                                <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-black text-violet-700">
                                  {space.assets.length} escena{space.assets.length !== 1 ? 's' : ''}
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <button type="button" onClick={() => handleOpenAssetForm(property.id, space.id)} className="rounded-full border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-black text-violet-700 transition-colors hover:bg-violet-100">
                                Nueva escena
                              </button>
                              <button type="button" onClick={() => handleEditSpace(property.id, space)} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 transition-colors hover:bg-slate-100">
                                Editar espacio
                              </button>
                              <button type="button" onClick={() => void handleToggleSpaceStatus(property.id, space)} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 transition-colors hover:bg-slate-100">
                                {space.status === 'HIDDEN' ? 'Activar' : 'Ocultar'}
                              </button>
                              <button type="button" onClick={() => void handleDeleteSpace(property.id, space.id)} className="ml-auto rounded-full px-4 py-2 text-sm font-black text-red-400 transition-colors hover:bg-red-50 hover:text-red-600">
                                Eliminar
                              </button>
                            </div>
                          </div>

                          {activeAssetFormTarget?.propertyId === property.id && activeAssetFormTarget?.spaceId === space.id ? (
                            <form onSubmit={(event) => void handleSubmitAsset(event, property.id, space.id)} className="mt-4 grid grid-cols-1 gap-3 rounded-2xl border border-violet-100 bg-violet-50/70 p-4 md:grid-cols-2">
                              <div className="md:col-span-2">
                                <p className="text-sm font-black text-slate-950">
                                  {editingAsset?.propertyId === property.id && editingAsset?.spaceId === space.id ? 'Editar escena inmersiva' : 'Añadir escena inmersiva'}
                                </p>
                                <p className="mt-1 text-xs font-semibold text-slate-500">
                                  Sube una imagen 360°, un modelo 3D o un escaneo 3D para esta estancia
                                </p>
                              </div>

                              {/* Asset type pill selector */}
                              <div className="md:col-span-2">
                                <span className="mb-2 block text-sm font-black text-slate-700">Tipo de escena</span>
                                <div className="flex gap-2">
                                  {([
                                    { value: 'panorama_360', label: 'Panorama 360', hint: 'JPG / WebP' },
                                    { value: 'gaussian_splat', label: 'Escaneo 3D', hint: 'SPLAT / PLY' },
                                    { value: 'mesh', label: 'Modelo 3D', hint: 'GLB' }
                                  ] as const).map(({ value, label, hint }) => (
                                    <button
                                      key={value}
                                      type="button"
                                      onClick={() => handleAssetTypeChange(value)}
                                      className={`flex flex-1 flex-col items-center rounded-2xl border px-3 py-3 text-center transition ${
                                        assetForm.type === value
                                          ? 'border-violet-500 bg-violet-50 text-violet-700 ring-1 ring-violet-400'
                                          : 'border-slate-200 bg-white text-slate-600 hover:border-violet-300 hover:bg-violet-50/40'
                                      }`}
                                    >
                                      <span className="text-sm font-black leading-none">{label}</span>
                                      <span className="mt-1 text-[10px] font-semibold text-slate-400">{hint}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Format selector – hidden (auto-detected on upload, kept in state) */}
                              <div className="hidden">
                                <select
                                  value={assetForm.format}
                                  onChange={(event) => setAssetForm((current) => ({ ...current, format: event.target.value as CreateAssetPayload['format'] }))}
                                  tabIndex={-1}
                                  aria-hidden="true"
                                >
                                  <option value="jpg">JPG</option>
                                  <option value="jpeg">JPEG</option>
                                  <option value="png">PNG</option>
                                  <option value="webp">WEBP</option>
                                  <option value="splat">SPLAT</option>
                                  <option value="ply">PLY</option>
                                  <option value="glb">GLB</option>
                                </select>
                              </div>

                              <div className="md:col-span-2">
                                <span className="mb-2 block text-sm font-black text-slate-700">Subir archivo</span>

                                {/* Drop zone */}
                                <label
                                  className={`relative flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition ${
                                    isUploadingAsset
                                      ? 'cursor-not-allowed border-slate-200 bg-slate-50'
                                      : isDragOver
                                        ? 'scale-[1.01] border-violet-500 bg-violet-100'
                                        : uploadPhase === 'done'
                                          ? 'border-emerald-400 bg-emerald-50/60'
                                          : 'border-violet-300 bg-violet-50/50 hover:bg-violet-50'
                                  }`}
                                  onDragOver={(e) => { e.preventDefault(); if (!isUploadingAsset) setIsDragOver(true); }}
                                  onDragEnter={(e) => { e.preventDefault(); if (!isUploadingAsset) setIsDragOver(true); }}
                                  onDragLeave={() => { setIsDragOver(false); }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    setIsDragOver(false);
                                    if (isUploadingAsset) return;
                                    const file = e.dataTransfer.files[0];
                                    if (file) void processAssetFile(file);
                                  }}
                                >
                                  <input
                                    type="file"
                                    accept=".jpg,.jpeg,.png,.webp,.splat,.ply,.glb"
                                    onChange={(event) => void handleAssetFileUpload(event)}
                                    disabled={isUploadingAsset}
                                    className="sr-only"
                                  />

                                  {/* Icon */}
                                  {uploadPhase === 'done' ? (
                                    <span className="text-2xl leading-none">âœ…</span>
                                  ) : isUploadingAsset ? (
                                    <span className="h-6 w-6 animate-spin rounded-full border-2 border-violet-300 border-t-violet-700" />
                                  ) : (
                                    <span className="text-2xl leading-none">{isDragOver ? 'ðŸ"‚' : 'ðŸ"'}</span>
                                  )}

                                  {/* Label */}
                                  <span className={`text-sm font-black ${uploadPhase === 'done' ? 'text-emerald-700' : 'text-violet-700'}`}>
                                    {isUploadingAsset
                                      ? (uploadPhase === 'processing' ? 'Procesando en Cloudinary…' : `Subiendo… ${uploadProgress}%`)
                                      : isDragOver
                                        ? 'Suelta el archivo aquí'
                                        : uploadPhase === 'done'
                                          ? `âœ" ${selectedAssetFileName ?? 'Archivo subido'}`
                                          : 'Arrastra tu archivo aquí o haz clic para seleccionar'}
                                  </span>

                                  {/* Hint */}
                                  {!isUploadingAsset && uploadPhase !== 'done' ? (
                                    <span className="text-xs font-semibold text-slate-400">
                                      JPG / WebP para 360° · GLB para modelos 3D · SPZ / SPLAT / PLY para escaneos 3D · Máx. 100 MB
                                    </span>
                                  ) : null}

                                  {/* Progress bar */}
                                  {isUploadingAsset ? (
                                    <div className="w-full max-w-xs overflow-hidden rounded-full bg-violet-100">
                                      <div
                                        className="h-1.5 rounded-full bg-violet-500 transition-all duration-300"
                                        style={{ width: `${uploadProgress}%` }}
                                      />
                                    </div>
                                  ) : null}
                                </label>

                                {/* Preview section – shown after upload */}
                                {uploadPhase === 'done' && assetPreviewUrl ? (
                                  <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                                    {assetPreviewType === 'panorama_360' ? (
                                      <div className="relative aspect-video bg-slate-900">
                                        <img
                                          src={assetPreviewUrl}
                                          alt="Preview"
                                          className="h-full w-full object-cover"
                                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                        />
                                        <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">
                                          Vista previa · Panorama 360°
                                        </span>
                                      </div>
                                    ) : (
                                      /* GLB / Splat: file card */
                                      <div className="flex items-center gap-3 px-4 py-3">
                                        <span className="text-2xl leading-none">
                                          {assetPreviewType === 'gaussian_splat' ? 'âœ¨' : 'ðŸ"¦'}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                          <p className="truncate text-sm font-black text-slate-900">{selectedAssetFileName}</p>
                                          <p className="text-xs font-semibold text-slate-400">
                                            {assetPreviewType === 'gaussian_splat' ? 'Escaneo 3D' : 'Modelo 3D · GLB'}
                                            {(assetForm.size ?? 0) > 0 ? ` · ${assetForm.size} MB` : ''}
                                          </p>
                                        </div>
                                        <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black text-emerald-700">
                                          Subido
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                ) : null}
                              </div>

                              {/* Paste URL shortcut — shown only when no file uploaded yet */}
                              {uploadPhase !== 'done' && !assetForm.url ? (
                                <div className="md:col-span-2 -mt-1 text-center">
                                  <button
                                    type="button"
                                    onClick={() => setShowAdvancedAsset(true)}
                                    className="text-xs font-semibold text-slate-400 underline-offset-2 hover:text-violet-600 hover:underline"
                                  >
                                    ¿Tienes una URL? Pégala directamente
                                  </button>
                                </div>
                              ) : null}

                              {/* ── D. Configuración avanzada (disclosure) ── */}
                              <div className="md:col-span-2">
                                <button
                                  type="button"
                                  onClick={() => setShowAdvancedAsset((v) => !v)}
                                  className="flex w-full items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-600 hover:bg-slate-50"
                                >
                                  <span className="flex-1 text-left">Configuración avanzada</span>
                                  <span className={`text-xs transition-transform duration-200 ${showAdvancedAsset ? 'rotate-180' : ''}`}>▼</span>
                                </button>

                                {showAdvancedAsset ? (
                                  <div className="mt-2 grid grid-cols-1 gap-3 rounded-2xl border border-slate-100 bg-white p-4 md:grid-cols-2">
                                    <div className="md:col-span-2">
                                      <label className="block">
                                        <span className="mb-2 block text-sm font-black text-slate-700">
                                          URL de la escena <span className="font-semibold text-slate-400">(auto · o pega una URL directamente)</span>
                                        </span>
                                        <input
                                          type="url"
                                          value={assetForm.url ?? ''}
                                          onChange={(event) => setAssetForm((current) => ({ ...current, url: event.target.value }))}
                                          placeholder="https://res.cloudinary.com/…"
                                          className={`w-full rounded-2xl border px-4 py-3 text-sm font-semibold outline-none transition ${
                                            assetForm.url && !assetForm.url.startsWith('http')
                                              ? 'border-amber-400 bg-amber-50 focus:border-amber-500'
                                              : 'border-slate-200 bg-white focus:border-violet-400'
                                          }`}
                                        />
                                        {assetForm.url && !assetForm.url.startsWith('http') ? (
                                          <p className="mt-1 text-xs font-semibold text-amber-600">La URL debe empezar por https://</p>
                                        ) : null}
                                      </label>
                                    </div>
                                    <label className="block">
                                      <span className="mb-2 block text-sm font-black text-slate-700">Miniatura <span className="font-semibold text-slate-400">(auto)</span></span>
                                      <input
                                        type="url"
                                        value={assetForm.thumbnail ?? ''}
                                        onChange={(event) => setAssetForm((current) => ({ ...current, thumbnail: event.target.value }))}
                                        placeholder="https://…"
                                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-violet-400"
                                      />
                                    </label>
                                    <label className="block">
                                      <span className="mb-2 block text-sm font-black text-slate-700">Tamaño <span className="font-semibold text-slate-400">(MB · auto)</span></span>
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={String(assetForm.size ?? 0)}
                                        onChange={(event) => setAssetForm((current) => ({ ...current, size: Number(event.target.value) }))}
                                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-violet-400"
                                      />
                                    </label>
                                  </div>
                                ) : null}
                              </div>

                              {/* â"€â"€ Visual hotspot placement editor (panorama_360 only) â"€â"€ */}
                              {assetForm.type === 'panorama_360' && assetForm.url.trim() ? (
                                <div
                                  ref={hotspotPreviewRef}
                                  className={`relative md:col-span-2 overflow-hidden rounded-2xl bg-slate-900 select-none ${showHotspotForm ? 'cursor-crosshair' : 'cursor-default'}`}
                                  style={{ aspectRatio: '16/9' }}
                                  onClick={(e) => {
                                    if (!showHotspotForm || draggingHotspotIdx !== null) return;
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const x = Math.max(0, Math.min(100, Math.round(((e.clientX - rect.left) / rect.width) * 100)));
                                    const y = Math.max(0, Math.min(100, Math.round(((e.clientY - rect.top) / rect.height) * 100)));
                                    setHotspotDraft((d) => ({ ...d, x, y }));
                                  }}
                                  onPointerMove={(e) => {
                                    if (draggingHotspotIdx === null) return;
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const x = Math.max(0, Math.min(100, Math.round(((e.clientX - rect.left) / rect.width) * 100)));
                                    const y = Math.max(0, Math.min(100, Math.round(((e.clientY - rect.top) / rect.height) * 100)));
                                    if (draggingHotspotIdx === -1) {
                                      setHotspotDraft((d) => ({ ...d, x, y }));
                                    } else if (editingHotspotIndex === draggingHotspotIdx) {
                                      // Dragging an editing pin â†' update draft position
                                      setHotspotDraft((d) => ({ ...d, x, y }));
                                    } else {
                                      setAssetForm((curr) => ({
                                        ...curr,
                                        hotspots: (curr.hotspots ?? []).map((h, i) =>
                                          i === draggingHotspotIdx ? { ...h, position: { x, y } } : h
                                        )
                                      }));
                                    }
                                  }}
                                  onPointerUp={() => {
                                    // Detect click (< 5px movement) on an existing pin â†' open edit form
                                    if (pinPointerStart.current !== null && draggingHotspotIdx !== null && draggingHotspotIdx >= 0) {
                                      const dx = pinPointerStart.current.x;
                                      const dy = pinPointerStart.current.y;
                                      // dx/dy were stored as clientX/Y at start; compare via ref
                                      void dx; void dy; // already consumed via pinPointerStart
                                    }
                                    pinPointerStart.current = null;
                                    setDraggingHotspotIdx(null);
                                  }}
                                  onPointerLeave={() => {
                                    pinPointerStart.current = null;
                                    setDraggingHotspotIdx(null);
                                  }}
                                >
                                  <img
                                    src={assetForm.url}
                                    alt="Vista previa 360"
                                    className="pointer-events-none h-full w-full object-cover"
                                    draggable={false}
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                  />

                                  {/* Existing hotspot pins – skip the one currently being edited (shown by draft pin) */}
                                  {(assetForm.hotspots ?? []).map((hotspot, idx) => {
                                    if (editingHotspotIndex === idx) return null;
                                    return (
                                      <div
                                        key={hotspot.id}
                                        className="absolute -translate-x-1/2 -translate-y-1/2 flex touch-none flex-col items-center gap-0.5"
                                        style={{
                                          left: `${hotspot.position.x}%`,
                                          top: `${hotspot.position.y}%`,
                                          zIndex: draggingHotspotIdx === idx ? 20 : 10,
                                          cursor: draggingHotspotIdx === idx ? 'grabbing' : (showHotspotForm ? 'grab' : 'pointer')
                                        }}
                                        onPointerDown={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          pinPointerStart.current = { x: e.clientX, y: e.clientY, idx };
                                          setDraggingHotspotIdx(idx);
                                        }}
                                        onPointerUp={(e) => {
                                          e.stopPropagation();
                                          if (pinPointerStart.current !== null) {
                                            const moved = Math.abs(e.clientX - pinPointerStart.current.x) + Math.abs(e.clientY - pinPointerStart.current.y);
                                            if (moved < 5 && !showHotspotForm) {
                                              // Click: open edit form for this pin
                                              handleEditHotspot(idx);
                                            }
                                          }
                                          pinPointerStart.current = null;
                                          setDraggingHotspotIdx(null);
                                        }}
                                      >
                                        <div className={`h-5 w-5 rounded-full border-2 border-white shadow-lg ring-1 ring-black/20 ${
                                          hotspot.type === 'navigation' ? 'bg-fuchsia-500' :
                                          hotspot.type === 'cta' ? 'bg-emerald-500' :
                                          hotspot.type === 'measurement' ? 'bg-amber-500' :
                                          'bg-violet-500'
                                        }`} />
                                        <div className="max-w-[96px] truncate rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold leading-tight text-white">
                                          {hotspot.label}
                                        </div>
                                      </div>
                                    );
                                  })}

                                  {/* Draft pin – shown while hotspot form is open (adding new OR editing existing) */}
                                  {showHotspotForm ? (
                                    <div
                                      className="absolute -translate-x-1/2 -translate-y-1/2 flex touch-none flex-col items-center gap-0.5"
                                      style={{
                                        left: `${hotspotDraft.x}%`,
                                        top: `${hotspotDraft.y}%`,
                                        zIndex: 15,
                                        cursor: draggingHotspotIdx === -1 ? 'grabbing' : 'grab'
                                      }}
                                      onPointerDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setDraggingHotspotIdx(editingHotspotIndex !== null ? editingHotspotIndex : -1);
                                      }}
                                    >
                                      <div className={`h-5 w-5 rounded-full border-2 border-white shadow-lg ${
                                        editingHotspotIndex !== null
                                          ? 'bg-amber-400 ring-2 ring-amber-300/60'
                                          : 'animate-pulse bg-violet-400 ring-2 ring-violet-300/50'
                                      }`} />
                                      <div className={`max-w-[96px] truncate rounded-full px-2 py-0.5 text-[10px] font-bold leading-tight text-white ${
                                        editingHotspotIndex !== null ? 'bg-amber-700/80' : 'bg-violet-700/80'
                                      }`}>
                                        {hotspotDraft.label || (editingHotspotIndex !== null ? 'editando' : 'nuevo')}
                                      </div>
                                    </div>
                                  ) : null}

                                  {/* Status bar */}
                                  {showHotspotForm ? (
                                    <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">
                                      {editingHotspotIndex !== null
                                        ? 'Editando punto · Arrastra para mover'
                                        : 'Haz clic para colocar · Arrastra para mover'}
                                    </div>
                                  ) : (assetForm.hotspots ?? []).length > 0 ? (
                                    <div className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-black/50 px-3 py-1 text-xs font-semibold text-white">
                                      {(assetForm.hotspots ?? []).length} punto{(assetForm.hotspots ?? []).length !== 1 ? 's' : ''} interactivo{(assetForm.hotspots ?? []).length !== 1 ? 's' : ''} · Pulsa un pin para editar
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}

                              <div className="md:col-span-2">
                                <div className="mb-3 flex items-center justify-between">
                                  <p className="text-sm font-black text-slate-950">
                                    Puntos interactivos ({(assetForm.hotspots ?? []).length})
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (showHotspotForm) {
                                        setShowHotspotForm(false);
                                        setEditingHotspotIndex(null);
                                        setHotspotDraft({ label: '', type: 'info', x: 50, y: 50, body: '', metric: '', targetSpaceId: '' });
                                      } else {
                                        setShowHotspotForm(true);
                                      }
                                    }}
                                    className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white hover:bg-violet-700"
                                  >
                                    {showHotspotForm ? 'Cancelar' : '+ Añadir punto'}
                                  </button>
                                </div>

                                {(assetForm.hotspots ?? []).length > 0 ? (
                                  <div className="mb-3 space-y-2">
                                    {(assetForm.hotspots ?? []).map((hotspot, index) => (
                                      <div key={hotspot.id} className="flex items-center justify-between rounded-xl bg-white px-4 py-2.5 ring-1 ring-slate-200">
                                        <div className="flex min-w-0 items-center gap-2">
                                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-black ${
                                            hotspot.type === 'cta' ? 'bg-emerald-50 text-emerald-700' :
                                            hotspot.type === 'navigation' ? 'bg-fuchsia-50 text-fuchsia-700' :
                                            hotspot.type === 'measurement' ? 'bg-amber-50 text-amber-700' :
                                            'bg-slate-100 text-slate-700'
                                          }`}>{translateHotspotType(hotspot.type)}</span>
                                          <span className="truncate text-sm font-bold text-slate-800">{hotspot.label}</span>
                                          {hotspot.type === 'navigation' && hotspot.targetSpaceId ? (
                                            <span className="shrink-0 text-xs text-fuchsia-600">→ {property.spaces.find((s) => s.id === hotspot.targetSpaceId)?.name ?? '?'}</span>
                                          ) : null}
                                        </div>
                                        <div className="ml-2 flex shrink-0 gap-1">
                                          <button
                                            type="button"
                                            onClick={() => handleEditHotspot(index)}
                                            className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700 hover:bg-violet-100 hover:text-violet-700"
                                          >
                                            Editar
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveHotspot(index)}
                                            className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700 hover:bg-red-100"
                                          >
                                            Eliminar
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : null}

                                {showHotspotForm ? (
                                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                    <div className="grid grid-cols-2 gap-3">
                                      <label className="col-span-2 block">
                                        <span className="mb-1 block text-xs font-black text-slate-700">Etiqueta</span>
                                        <input
                                          type="text"
                                          value={hotspotDraft.label}
                                          onChange={(e) => setHotspotDraft((d) => ({ ...d, label: e.target.value }))}
                                          placeholder="Ej: Salón principal"
                                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-violet-400"
                                        />
                                      </label>
                                      <label className="block">
                                        <span className="mb-1 block text-xs font-black text-slate-700">Tipo</span>
                                        <select
                                          value={hotspotDraft.type}
                                          onChange={(e) => {
                                            const newType = e.target.value as Hotspot['type'];
                                            setHotspotDraft((d) => ({
                                              ...d,
                                              type: newType,
                                              // clear targetSpaceId when leaving navigation type
                                              targetSpaceId: newType === 'navigation' ? d.targetSpaceId : ''
                                            }));
                                          }}
                                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-violet-400"
                                        >
                                          <option value="info">Información</option>
                                          <option value="cta">Contacto</option>
                                          <option value="navigation">Navegación</option>
                                          <option value="measurement">Medición</option>
                                        </select>
                                      </label>

                                      {hotspotDraft.type === 'navigation' ? (
                                        <label className="col-span-2 block">
                                          <span className="mb-1 block text-xs font-black text-slate-700">Conectar con estancia</span>
                                          <select
                                            value={hotspotDraft.targetSpaceId}
                                            onChange={(e) => {
                                              const targetId = e.target.value;
                                              const targetName = property.spaces.find((s) => s.id === targetId)?.name ?? '';
                                              setHotspotDraft((d) => ({
                                                ...d,
                                                targetSpaceId: targetId,
                                                // auto-label only if label is empty or a previous auto-suggestion
                                                label: (d.label === '' || d.label.startsWith('Ir a '))
                                                  ? (targetName ? `Ir a ${targetName}` : d.label)
                                                  : d.label
                                              }));
                                            }}
                                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-violet-400"
                                          >
                                            <option value="">– Selecciona una estancia –</option>
                                            {property.spaces
                                              .filter((s) => s.id !== space.id)
                                              .sort((a, b) => a.order - b.order)
                                              .map((s) => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                              ))
                                            }
                                          </select>
                                          <p className="mt-1 text-xs text-slate-400">El visitante irá a esta estancia al pulsar el hotspot.</p>
                                        </label>
                                      ) : null}

                                      <label className="block">
                                        <span className="mb-1 block text-xs font-black text-slate-700">Descripción</span>
                                        <input
                                          type="text"
                                          value={hotspotDraft.body}
                                          onChange={(e) => setHotspotDraft((d) => ({ ...d, body: e.target.value }))}
                                          placeholder="Texto informativo"
                                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-violet-400"
                                        />
                                      </label>
                                      <label className="block">
                                        <span className="mb-1 block text-xs font-black text-slate-700">Métrica</span>
                                        <input
                                          type="text"
                                          value={hotspotDraft.metric}
                                          onChange={(e) => setHotspotDraft((d) => ({ ...d, metric: e.target.value }))}
                                          placeholder="Ej: 25 mÂ²"
                                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-violet-400"
                                        />
                                      </label>
                                      {/* X/Y inputs hidden: drag on the preview image to position */}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={editingHotspotIndex !== null ? handleSaveHotspotEdit : handleAddHotspot}
                                      disabled={
                                        !hotspotDraft.label.trim() ||
                                        (hotspotDraft.type === 'navigation' && !hotspotDraft.targetSpaceId)
                                      }
                                      className={`mt-3 rounded-xl px-4 py-2 text-xs font-black text-white disabled:opacity-50 ${
                                        editingHotspotIndex !== null
                                          ? 'bg-amber-500 hover:bg-amber-600'
                                          : 'bg-slate-950 hover:bg-violet-700'
                                      }`}
                                    >
                                      {editingHotspotIndex !== null ? 'Guardar cambios' : 'Añadir punto interactivo'}
                                    </button>
                                  </div>
                                ) : null}
                              </div>

                              <div className="flex flex-wrap gap-2 md:col-span-2">
                                <button disabled={isLoading || isUploadingAsset} type="submit" className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-violet-700 disabled:opacity-60">
                                  {isUploadingAsset
                                    ? 'Subiendo...'
                                    : editingAsset?.propertyId === property.id && editingAsset?.spaceId === space.id
                                      ? 'Guardar escena'
                                      : 'Crear escena'}
                                </button>
                                <button type="button" onClick={closeAssetForm} className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
                                  Cancelar
                                </button>
                              </div>
                            </form>
                          ) : null}

                          {assetForm.type === 'mesh' &&
                          (assetForm.url ?? '').trim().length > 0 &&
                          !String(assetForm.url ?? '').startsWith('demo://') &&
                          activeAssetFormTarget?.propertyId === property.id &&
                          activeAssetFormTarget?.spaceId === space.id ? (
                            <div className="mt-4">
                              <p className="mb-2 text-sm font-black text-slate-950">
                                Vista previa del objeto 3D
                              </p>
                              <Suspense fallback={
                                <div className="flex min-h-[300px] items-center justify-center rounded-[1.5rem] bg-slate-100">
                                  <p className="text-sm font-bold text-slate-400">Cargando modelo 3D...</p>
                                </div>
                              }>
                                <GlbViewer
                                  src={String(assetForm.url ?? '')}
                                  cameraControls
                                  autoRotate
                                />
                              </Suspense>
                            </div>
                          ) : null}

                          <div className="mt-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                            <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                              <div>
                                <p className="text-sm font-black text-slate-950">Escenas de la estancia</p>
                                <p className="text-xs font-semibold text-slate-500">Panorama 360°, escaneo 3D o modelo 3D asociados a esta estancia.</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                              {space.assets.length === 0 ? (
                                <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
                                  <p className="text-sm font-black text-slate-800">Empieza el recorrido con una escena principal</p>
                                  <p className="mt-1 text-xs font-semibold text-slate-400">Los visitantes comenzaran la experiencia desde aqui. Sube un panorama 360° o un escaneo 3D.</p>
                                </div>
                              ) : (
                                space.assets.map((asset) => (
                                  <div key={asset.id} className="flex flex-col gap-3 rounded-xl bg-white p-3 ring-1 ring-slate-200 md:flex-row md:items-center md:justify-between">
                                    <div className="flex items-start gap-3">
                                      {asset.thumbnail && !isFallbackAssetId(asset.id) ? (
                                        <img
                                          src={asset.thumbnail}
                                          alt={asset.type}
                                          className="h-14 w-14 flex-shrink-0 rounded-xl object-cover ring-1 ring-slate-200"
                                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                        />
                                      ) : (
                                        <div className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl text-xs font-black ${
                                          asset.type === 'gaussian_splat'
                                            ? 'bg-violet-100 text-violet-700'
                                            : asset.type === 'mesh'
                                              ? 'bg-fuchsia-100 text-fuchsia-700'
                                              : 'bg-violet-100 text-violet-700'
                                        }`}>
                                          {asset.type === 'gaussian_splat' ? 'SPLAT' : asset.type === 'mesh' ? 'GLB' : '360'}
                                        </div>
                                      )}
                                      <div>
                                        <div className="mb-2 flex flex-wrap gap-2">
                                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{translateAssetType(asset.type)}</span>
                                          {(asset.size ?? 0) > 0 ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{asset.size} MB</span> : null}
                                          {isFallbackAssetId(asset.id) ? (
                                            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">Demo temporal</span>
                                          ) : null}
                                        </div>
                                        <p className="max-w-xl truncate text-sm font-bold text-slate-700">{asset.url || 'Sin URL'}</p>
                                      </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                      <button type="button" onClick={() => handleEditAsset(property.id, space.id, asset)} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 transition-colors hover:bg-slate-100">
                                        Editar escena
                                      </button>
                                      <button type="button" onClick={() => void handleDeleteAsset(property.id, space.id, asset.id)} className="ml-auto rounded-full px-3 py-2 text-sm font-black text-red-400 transition-colors hover:bg-red-50 hover:text-red-600">
                                        Eliminar
                                      </button>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      ))                    )}
                  </div>
                  </div>{/* /p-4 */}
                </div>
                );
              })() : null}

              {leadsPropertyId === property.id ? (
                <div className="mt-5 rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h4 className="text-lg font-black text-slate-950">Leads captados</h4>
                      <p className="text-sm font-semibold text-slate-500">Contactos recibidos desde el visor inmersivo.</p>
                    </div>
                    {leads.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => void handleExportLeadsCsv(property.id, property.title)}
                        className="rounded-full bg-white px-4 py-2 text-sm font-black text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                      >
                        Exportar CSV
                      </button>
                    ) : null}
                  </div>

                  {leadsLoading ? (
                    <p className="text-sm font-bold text-slate-500">Cargando leads...</p>
                  ) : leadsError ? (
                    <div className="rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">{leadsError}</div>
                  ) : leads.length === 0 ? (
                    <div className="rounded-2xl bg-white p-4 text-sm font-bold text-slate-500 ring-1 ring-slate-200">
                      Aun no hay contactos para esta propiedad. Los leads apareceran aqui cuando los compradores interactuen con el tour.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-400">Email</th>
                            <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-400">Teléfono</th>
                            <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-400">Notas</th>
                            <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-400">Fuente</th>
                            <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-400">Fecha</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leads.map((lead, index) => (
                            <tr key={lead.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                              <td className="px-4 py-3 font-semibold text-slate-800">{lead.email}</td>
                              <td className="px-4 py-3 text-slate-600">{lead.phone || '–'}</td>
                              <td className="max-w-xs px-4 py-3 text-slate-600">
                                <span className="line-clamp-1">{lead.notes || '–'}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{lead.source}</span>
                              </td>
                              <td className="px-4 py-3 text-slate-500">
                                {new Date(lead.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : null}
              </div>{/* /p-5 */}
            </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
