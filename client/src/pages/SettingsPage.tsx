import { useState, useEffect, useRef } from 'react';
import type { ChangeEvent } from 'react';
import { Helmet } from 'react-helmet-async';
import { useBrand } from '@/hooks/useBrand';
import { M, loadGSAP } from '@/lib/motion';
import { useAuthStore } from '@/store/authStore';
import { api, unwrapApiResponse, getApiErrorMessage } from '@/services/api';
import type { SubscriptionResponse, TenantUsageResponse, StorageUsageResponse, UploadAssetResponse } from '@/types/api';
import PlanCard from '@/components/billing/PlanCard';
import AvatarWidget from '@/components/AvatarWidget';

export default function SettingsPage(): JSX.Element {
  const { user, hydrateFromStorage } = useAuthStore();
  const [usage, setUsage] = useState<TenantUsageResponse | null>(null);
  const [storage, setStorage] = useState<StorageUsageResponse | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);
  const [webhookInput, setWebhookInput] = useState(user?.tenant.webhookUrl ?? '');
  const [webhookSaving, setWebhookSaving] = useState(false);
  const [phoneInput, setPhoneInput] = useState(user?.tenant.phone ?? '');
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [removeBranding, setRemoveBranding] = useState(user?.tenant.removeBranding ?? false);
  const [brandingSaving, setBrandingSaving] = useState(false);
  const [whatsappInput, setWhatsappInput] = useState(user?.tenant.whatsappNumber ?? '');
  const [whatsappSaving, setWhatsappSaving] = useState(false);
  const [calendlyInput, setCalendlyInput] = useState(user?.tenant.calendlyUrl ?? '');
  const [calendlySaving, setCalendlySaving] = useState(false);
  const [primaryColorInput, setPrimaryColorInput] = useState(user?.tenant.primaryColor ?? '#7C3AED');
  const [colorSaving, setColorSaving] = useState(false);
  const [logoTextInput, setLogoTextInput] = useState(user?.tenant.logoText ?? '');
  const [avatarUploading, setAvatarUploading] = useState(false);

  useEffect(() => {
    void loadBillingState();
  }, []);

  async function loadBillingState(): Promise<void> {
    try {
      const [usageResponse, subscriptionResponse, storageResponse] = await Promise.all([
        unwrapApiResponse<TenantUsageResponse>(api.get('/tenants/usage')),
        unwrapApiResponse<SubscriptionResponse>(api.get('/subscriptions/current')),
        unwrapApiResponse<StorageUsageResponse>(api.get('/tenants/storage'))
      ]);
      setUsage(usageResponse);
      setSubscription(subscriptionResponse);
      setStorage(storageResponse);
      hydrateFromStorage();
      setError(null);
    } catch (error) {
      setError(getApiErrorMessage(error));
    }
  }

  async function handleAvatarUpload(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    setSettingsMsg(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const upload = await unwrapApiResponse<UploadAssetResponse>(
        api.post('/uploads', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      );
      await unwrapApiResponse(api.patch('/auth/me/avatar', { avatarUrl: upload.url }));
      const stored = window.localStorage.getItem('user');
      if (stored) {
        const parsed = JSON.parse(stored);
        parsed.avatarUrl = upload.url;
        window.localStorage.setItem('user', JSON.stringify(parsed));
        hydrateFromStorage();
      }
      setSettingsMsg('Foto de perfil actualizada.');
    } catch {
      setSettingsMsg('Error al subir la foto de perfil.');
    } finally {
      setAvatarUploading(false);
      event.target.value = '';
    }
  }

  async function handleLogoUpload(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    setSettingsMsg(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const upload = await unwrapApiResponse<UploadAssetResponse>(
        api.post('/uploads', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      );
      await unwrapApiResponse(api.put('/tenants/settings', { logoUrl: upload.url }));
      hydrateFromStorage();
      setSettingsMsg('Logo actualizado correctamente.');
      // Reload user from API to reflect change in header
      const settings = await unwrapApiResponse<{ id: string; logoUrl: string }>(api.get('/tenants/settings'));
      const stored = window.localStorage.getItem('user');
      if (stored) {
        const parsed = JSON.parse(stored);
        parsed.tenant.logoUrl = settings.logoUrl;
        window.localStorage.setItem('user', JSON.stringify(parsed));
        hydrateFromStorage();
      }
    } catch {
      setSettingsMsg('Error al subir el logo.');
    } finally {
      setLogoUploading(false);
      event.target.value = '';
    }
  }

  async function handleSaveWebhook(): Promise<void> {
    const url = webhookInput.trim();
    if (url && !url.startsWith('https://')) {
      setSettingsMsg('La URL del webhook debe empezar por https://');
      return;
    }
    setWebhookSaving(true);
    setSettingsMsg(null);
    try {
      await unwrapApiResponse(api.put('/tenants/settings', { webhookUrl: url }));
      setSettingsMsg('Webhook guardado correctamente.');
    } catch {
      setSettingsMsg('Error al guardar el webhook.');
    } finally {
      setWebhookSaving(false);
    }
  }

  async function handleSavePhone(): Promise<void> {
    setPhoneSaving(true);
    setSettingsMsg(null);
    try {
      await unwrapApiResponse(api.put('/tenants/settings', { phone: phoneInput.trim() }));
      setSettingsMsg('Teléfono guardado correctamente.');
    } catch {
      setSettingsMsg('Error al guardar el teléfono.');
    } finally {
      setPhoneSaving(false);
    }
  }

  async function handleToggleRemoveBranding(value: boolean): Promise<void> {
    setRemoveBranding(value);
    setBrandingSaving(true);
    setSettingsMsg(null);
    try {
      await unwrapApiResponse(api.put('/tenants/settings', { removeBranding: value }));
      setSettingsMsg(value ? 'Marca "Powered by" eliminada del tour.' : 'Marca "Powered by" activada en el tour.');
    } catch {
      setRemoveBranding(!value);
      setSettingsMsg('Error al guardar la configuración.');
    } finally {
      setBrandingSaving(false);
    }
  }

  async function handleSaveWhatsapp(): Promise<void> {
    setWhatsappSaving(true);
    setSettingsMsg(null);
    try {
      await unwrapApiResponse(api.put('/tenants/settings', { whatsappNumber: whatsappInput.trim() }));
      setSettingsMsg('Número de WhatsApp guardado correctamente.');
    } catch {
      setSettingsMsg('Error al guardar el número de WhatsApp.');
    } finally {
      setWhatsappSaving(false);
    }
  }

  async function handleSaveCalendly(): Promise<void> {
    setCalendlySaving(true);
    setSettingsMsg(null);
    try {
      await unwrapApiResponse(api.put('/tenants/settings', { calendlyUrl: calendlyInput.trim() }));
      setSettingsMsg('URL de Calendly guardada correctamente.');
    } catch {
      setSettingsMsg('Error al guardar la URL de Calendly.');
    } finally {
      setCalendlySaving(false);
    }
  }

  function patchStoredUser(patch: Record<string, unknown>): void {
    const stored = window.localStorage.getItem('user');
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      Object.assign(parsed.tenant, patch);
      window.localStorage.setItem('user', JSON.stringify(parsed));
      hydrateFromStorage();
    } catch { /* ignore */ }
  }

  async function handleSaveColor(): Promise<void> {
    if (!/^#[0-9A-Fa-f]{6}$/.test(primaryColorInput)) {
      setSettingsMsg('Color inválido. Usa formato #RRGGBB (ej. #7C3AED).');
      return;
    }
    setColorSaving(true);
    setSettingsMsg(null);
    try {
      await unwrapApiResponse(api.put('/tenants/settings', { primaryColor: primaryColorInput }));
      patchStoredUser({ primaryColor: primaryColorInput });
      setSettingsMsg('Color de marca guardado.');
    } catch {
      setSettingsMsg('Error al guardar el color.');
    } finally {
      setColorSaving(false);
    }
  }

  async function handleSaveLogoText(): Promise<void> {
    const val = logoTextInput.trim().slice(0, 3).toUpperCase();
    if (!val) {
      setSettingsMsg('Las iniciales no pueden estar vacías.');
      return;
    }
    try {
      await unwrapApiResponse(api.put('/tenants/settings', { logoText: val }));
      patchStoredUser({ logoText: val });
      setLogoTextInput(val);
      setSettingsMsg('Iniciales del logo guardadas.');
    } catch {
      setSettingsMsg('Error al guardar las iniciales.');
    }
  }

  async function openPortal(): Promise<void> {
    setPortalLoading(true);
    setError(null);

    try {
      const response = await unwrapApiResponse<{ url: string }>(api.post('/subscriptions/portal'));
      window.location.href = response.url;
    } catch (error) {
      setError(getApiErrorMessage(error));
      setPortalLoading(false);
    }
  }

  const currentPlan = subscription?.plan ?? user?.tenant.plan ?? 'STARTER';
  const { color, bgStyle, colorStyle } = useBrand();
  const mainRef = useRef<HTMLElement>(null);

  // Motion System — storytelling sections only (operational UI untouched)
  useEffect(() => {
    // eslint-disable-next-line prefer-const
    let ctx: any;
    loadGSAP().then(({ gsap, ScrollTrigger }) => {
      ctx = gsap.context(() => {

        // Storytelling A — 4-step workflow cards stagger on scroll
        // gsap.set initialises hidden BEFORE trigger — avoids immediateRender bug.
        gsap.set('.motion-story-card', { y: 32, opacity: 0 });
        ScrollTrigger.batch('.motion-story-card', {
          onEnter: (els) =>
            gsap.to(els, {
              y: 0,
              opacity: 1,
              duration: M.base,
              stagger: M.stagger,
              ease: M.ease,
            }),
          start: 'top 87%',
          once: true,
        });

        // Storytelling B — dark section fade+scale
        gsap.set('.motion-story-b', { y: 24, opacity: 0 });
        gsap.to('.motion-story-b', {
          y: 0,
          opacity: 1,
          duration: M.slow,
          ease: M.ease,
          scrollTrigger: {
            trigger: '.motion-story-b',
            start: 'top 85%',
            once: true,
          },
        });

        // Story B images — subtle scale reveal
        gsap.set('.motion-story-b-img', { scale: 1.04 });
        gsap.to('.motion-story-b-img', {
          scale: 1,
          duration: M.cinematic,
          ease: M.ease,
          stagger: 0.2,
          scrollTrigger: {
            trigger: '.motion-story-b',
            start: 'top 85%',
            once: true,
          },
        });

      }, mainRef);
    });
    return () => ctx?.revert();
  }, []);

  return (
    <main ref={mainRef} className="mx-auto max-w-7xl px-5 py-10">
      <Helmet>
        <title>Ajustes · Immersphere Pro</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.22em]" style={colorStyle}>Configuración</p>
          <h1 className="mt-3 text-5xl font-black tracking-tight">Planes y ajustes</h1>
          <p className="mt-3 text-slate-500">Plan actual: <strong>{currentPlan}</strong>. Propiedades usadas: {usage?.propertiesUsed ?? 0}.</p>
        </div>
        <button
          type="button"
          disabled={portalLoading}
          onClick={openPortal}
          className="rounded-full px-6 py-3 text-sm font-black text-white transition hover:opacity-90 disabled:opacity-60"
          style={bgStyle}
        >
          {portalLoading ? 'Abriendo portal...' : 'Gestionar facturación'}
        </button>
      </div>

      {error ? <div className="mt-6 rounded-2xl bg-red-50 p-4 font-bold text-red-700">{error}</div> : null}
      {settingsMsg ? <div className="mt-4 rounded-2xl bg-emerald-50 p-4 font-bold text-emerald-700">{settingsMsg}</div> : null}

      {/* ── Foto de perfil ──────────────────────────────────────────────── */}
      <div className="mt-6 rounded-[1.5rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Foto de perfil</p>
        <div className="mt-4 flex items-center gap-5">
          <AvatarWidget size={64} showLabel primaryColor={color} />
          <p className="text-xs text-slate-400">Haz clic en tu avatar para subir un archivo o hacer una foto con la cámara.</p>
        </div>
      </div>

      <div className="mt-6 rounded-[1.5rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Logo de la agencia</p>
        <div className="mt-4 flex items-center gap-5">
          {user?.tenant.logoUrl ? (
            <img src={user.tenant.logoUrl} alt="Logo" className="h-16 w-16 rounded-2xl object-cover ring-1 ring-slate-200" />
          ) : (
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-xl font-black text-white" style={bgStyle}>
              {logoTextInput.trim().slice(0,3).toUpperCase() || user?.tenant.logoText || '✦'}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <label className={`flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50 ${logoUploading ? 'cursor-not-allowed opacity-50' : ''}`}>
              <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => { void handleLogoUpload(e); }} disabled={logoUploading} className="sr-only" />
              {logoUploading ? 'Subiendo...' : '↑ Subir imagen'}
            </label>
            <p className="mt-1.5 text-xs text-slate-400">PNG, JPG, WEBP o SVG · 400×400 px recomendado.</p>
            {!user?.tenant.logoUrl ? (
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="text"
                  value={logoTextInput}
                  onChange={(e) => setLogoTextInput(e.target.value.slice(0, 3))}
                  maxLength={3}
                  placeholder="IP"
                  className="w-16 rounded-xl border border-slate-200 px-2 py-1.5 text-center text-sm font-black uppercase tracking-widest outline-none focus:border-violet-400"
                />
                <button
                  type="button"
                  onClick={() => { void handleSaveLogoText(); }}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-black text-slate-600 transition hover:border-violet-400 hover:text-violet-700"
                >
                  Guardar iniciales
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Color de marca ─────────────────────────────────────────── */}
      <div className="mt-6 rounded-[1.5rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Color de marca</p>
        <p className="mt-1 text-sm text-slate-500">Se aplica a botones, hotspots y CTAs del visor público.</p>
        <div className="mt-4 flex items-center gap-3">
          <div className="relative flex items-center">
            <input
              type="color"
              value={primaryColorInput}
              onChange={(e) => setPrimaryColorInput(e.target.value)}
              className="h-11 w-11 cursor-pointer rounded-xl border border-slate-200 p-1 outline-none"
              title="Seleccionar color"
            />
          </div>
          <input
            type="text"
            value={primaryColorInput}
            onChange={(e) => {
              const v = e.target.value;
              setPrimaryColorInput(v);
            }}
            onBlur={(e) => {
              if (!/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                setPrimaryColorInput(user?.tenant.primaryColor ?? '#7C3AED');
              }
            }}
            placeholder="#7C3AED"
            maxLength={7}
            className="w-28 rounded-2xl border border-slate-200 px-3 py-2.5 text-sm font-black uppercase tracking-widest outline-none focus:border-violet-400"
          />
          <button
            type="button"
            disabled={colorSaving}
            onClick={() => { void handleSaveColor(); }}
            className="rounded-2xl px-5 py-2.5 text-sm font-black text-white transition hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: primaryColorInput }}
          >
            {colorSaving ? 'Guardando...' : 'Guardar color'}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {['#7C3AED', '#2563EB', '#059669', '#DC2626', '#D97706', '#0F172A', '#DB2777', '#0891B2'].map((c) => (
            <button
              key={c}
              type="button"
              title={c}
              onClick={() => setPrimaryColorInput(c)}
              className="h-8 w-8 rounded-full border-2 transition hover:scale-110"
              style={{ backgroundColor: c, borderColor: primaryColorInput === c ? '#0f172a' : 'transparent' }}
            />
          ))}
        </div>
      </div>

      {/* ── Preview live ────────────────────────────────────────────── */}
      <div className="mt-6 rounded-[1.5rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Preview de marca</p>
        <p className="mt-1 text-sm text-slate-500">Vista previa en tiempo real de cómo verán tu marca los visitantes.</p>
        <div className="mt-4 overflow-hidden rounded-2xl bg-slate-950 text-white">
          {/* mini viewer header */}
          <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
            {user?.tenant.logoUrl ? (
              <img src={user.tenant.logoUrl} alt="Logo" className="h-9 w-9 rounded-xl object-cover" />
            ) : (
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black text-white"
                style={{ backgroundColor: primaryColorInput }}
              >
                {logoTextInput.trim().slice(0, 3).toUpperCase() || user?.tenant.logoText || 'IP'}
              </span>
            )}
            <div className="min-w-0">
              <p className="text-sm font-black leading-tight">{user?.tenant.name || 'Tu Agencia'}</p>
              <p className="text-xs font-semibold leading-tight" style={{ color: primaryColorInput }}>
                Visor inmersivo
              </p>
            </div>
          </div>
          {/* mini property preview */}
          <div className="px-5 py-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/35">Propiedad ejemplo</p>
            <p className="mt-1.5 text-lg font-black leading-tight">Apartamento en el centro</p>
            <p className="mt-1 text-sm text-white/50">Tour virtual inmersivo · 4 estancias</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-full px-5 py-2 text-xs font-black text-white"
                style={{ backgroundColor: primaryColorInput }}
              >
                Contactar agente
              </button>
              <button
                type="button"
                className="rounded-full bg-white/10 px-5 py-2 text-xs font-black text-white/70"
              >
                ▶ Tour guiado
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-[1.5rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Webhook de leads</p>
        <p className="mt-1 text-sm text-slate-500">Cada nuevo lead enviará un POST JSON a esta URL. Debe ser <code className="rounded bg-slate-100 px-1 text-xs">https://</code>.</p>
        <div className="mt-4 flex gap-3">
          <input
            type="url"
            value={webhookInput}
            onChange={(e) => setWebhookInput(e.target.value)}
            placeholder="https://tu-crm.com/webhook/leads"
            className="brand-focus flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none"
          />
          <button
            type="button"
            disabled={webhookSaving}
            onClick={() => { void handleSaveWebhook(); }}
            className="rounded-2xl px-5 py-3 text-sm font-black text-white transition hover:opacity-90 disabled:opacity-50"
            style={bgStyle}
          >
            {webhookSaving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-[1.5rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Teléfono de contacto</p>
        <p className="mt-1 text-sm text-slate-500">Número que se mostrará en el chatbot del visor para que los visitantes puedan llamar directamente.</p>
        <div className="mt-4 flex gap-3">
          <input
            type="tel"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            placeholder="+34 600 000 000"
            className="brand-focus flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none"
          />
          <button
            type="button"
            disabled={phoneSaving}
            onClick={() => { void handleSavePhone(); }}
            className="rounded-2xl px-5 py-3 text-sm font-black text-white transition hover:opacity-90 disabled:opacity-50"
            style={bgStyle}
          >
            {phoneSaving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-[1.5rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Eliminar marca "Powered by"</p>
            <p className="mt-1 text-sm text-slate-500">Cuando está activo, elimina la marca "Immersphere Pro" del visor público, del título de la página y del tour ZIP. El tour aparece completamente bajo tu marca.</p>
          </div>
          <button
            type="button"
            disabled={brandingSaving}
            onClick={() => { void handleToggleRemoveBranding(!removeBranding); }}
            className={`relative shrink-0 inline-flex h-7 w-12 items-center rounded-full transition-colors disabled:opacity-50 ${removeBranding ? 'bg-violet-600' : 'bg-slate-200'}`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${removeBranding ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-[1.5rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Reservar visita (Calendly)</p>
        <p className="mt-1 text-sm text-slate-500">Pega aquí tu enlace de Calendly. Aparecerá como botón "📅 Reservar visita" en la ficha de cada propiedad.</p>
        <div className="mt-4 flex gap-3">
          <input
            type="url"
            value={calendlyInput}
            onChange={(e) => setCalendlyInput(e.target.value)}
            placeholder="https://calendly.com/tu-agencia/visita"
            className="brand-focus flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none"
          />
          <button
            type="button"
            disabled={calendlySaving}
            onClick={() => { void handleSaveCalendly(); }}
            className="rounded-2xl px-5 py-3 text-sm font-black text-white transition hover:opacity-90 disabled:opacity-50"
            style={bgStyle}
          >
            {calendlySaving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-[1.5rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">WhatsApp de contacto</p>
        <p className="mt-1 text-sm text-slate-500">Número con prefijo internacional (ej. <code className="rounded bg-slate-100 px-1 text-xs">+34612345678</code>). Aparecerá como botón de WhatsApp en la ficha de propiedad.</p>
        <div className="mt-4 flex gap-3">
          <input
            type="tel"
            value={whatsappInput}
            onChange={(e) => setWhatsappInput(e.target.value)}
            placeholder="+34612345678"
            className="brand-focus flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none"
          />
          <button
            type="button"
            disabled={whatsappSaving}
            onClick={() => { void handleSaveWhatsapp(); }}
            className="rounded-2xl px-5 py-3 text-sm font-black text-white transition hover:opacity-90 disabled:opacity-50"
            style={bgStyle}
          >
            {whatsappSaving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      {storage ? (
        <div className="mt-6 rounded-[1.5rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Almacenamiento</p>
              <p className="mt-2 text-2xl font-black text-slate-950">
                {storage.isUnlimited
                  ? 'Ilimitado'
                  : `${storage.usedMb} MB / ${storage.limitMb} MB`}
              </p>
              {!storage.isUnlimited && storage.remainingMb !== null ? (
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  {storage.remainingMb} MB disponibles
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-3">
              {storage.isUnlimited ? (
                <span className="rounded-full bg-violet-100 px-4 py-2 text-xs font-black text-violet-700">
                  Enterprise — sin limite
                </span>
              ) : (
                <span className={`rounded-full px-4 py-2 text-xs font-black ${
                  storage.percentageUsed >= 90
                    ? 'bg-red-100 text-red-700'
                    : storage.percentageUsed >= 70
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {storage.percentageUsed}% usado
                </span>
              )}
            </div>
          </div>
          {!storage.isUnlimited && storage.limitMb !== null ? (
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all ${
                  storage.percentageUsed >= 90
                    ? 'bg-red-500'
                    : storage.percentageUsed >= 70
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                }`}
                style={{ width: `${storage.percentageUsed}%` }}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ── Plans editorial banner ── */}
      <div className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="grid sm:grid-cols-2">
          {/* Left: copy */}
          <div className="flex flex-col justify-center p-8">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-600 dark:text-violet-400">Planes Immersphere</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900 dark:text-white">Escala cuando lo necesites</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              Cambia de plan en cualquier momento desde este panel.
              Comparativa completa en{' '}
              <a href="/pricing" className="font-black text-violet-600 hover:underline dark:text-violet-400">/pricing</a>.
            </p>
            <a
              href="tel:+34629554870"
              className="mt-4 inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.07 1.18 2 2 0 012.07.03h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11l-1.27 1.27a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7a2 2 0 011.72 2.01z"/></svg>
              Agency / Enterprise · 629 554 870
            </a>
          </div>
          {/* Right: image — visible editorial */}
          <div className="relative min-h-[200px] overflow-hidden sm:min-h-[240px]">
            <img
              src="/images/settings-agent-screen-side.webp"
              alt="Agente revisando el dashboard de Immersphere Pro en oficina"
              className="h-full w-full object-cover object-center"
            />
            {/* gradient only on left edge to blend with content */}
            <div className="absolute inset-0 bg-gradient-to-r from-white/70 via-transparent to-transparent dark:from-slate-900/70" />
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <PlanCard
          plan="STARTER"
          title="Starter"
          price="59 €/mes"
          description="Para agentes y pequeñas agencias. Hasta 5 propiedades activas, 1 usuario, tours 360°, QR, WhatsApp CTA y lead capture."
          currentPlan={currentPlan}
          onPlanChanged={loadBillingState}
          features={['5 propiedades activas', '1 usuario', 'Tours 360°', 'Share link + QR', 'Lead capture básico', 'Analytics básicos']}
        />
        <PlanCard
          plan="PROFESSIONAL"
          title="Pro"
          price="149 €/mes"
          description="Para agencias consolidadas. Hasta 25 propiedades, 3 usuarios, hero vídeo, analytics de engagement y Gaussian viewer."
          currentPlan={currentPlan}
          onPlanChanged={loadBillingState}
          features={['25 propiedades activas', '3 usuarios', 'Hero vídeo por propiedad', 'Analytics engagement', 'Tours con contraseña', 'Gaussian viewer']}
        />
        <PlanCard
          plan="ENTERPRISE"
          title="Agency"
          price="349 €/mes"
          description="Para agencias con volumen. Hasta 100 propiedades, 10 usuarios, white-label, iframe embed y soporte prioritario."
          currentPlan={currentPlan}
          onPlanChanged={loadBillingState}
          features={['100 propiedades activas', '10 usuarios', 'White-label completo', 'Iframe embed', 'PDF reports', 'Soporte prioritario']}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          STORYTELLING A — Cómo usan Immersphere las inmobiliarias
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="mt-16" aria-label="Así trabajan las agencias con Immersphere">
        <div className="mb-8 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
            Flujo de trabajo
          </span>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            Así trabajan las agencias con Immersphere
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-500 dark:text-slate-400">
            En 5 minutos. Sin técnicos. Sin depender de nadie.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {/* Step 1 — Alta */}
          <div className="motion-story-card group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
            <div className="relative overflow-hidden" style={{ paddingBottom: '66.6%' }}>
              <img
                src="/images/story-agency-signup.webp"
                alt="Agente dándose de alta en Immersphere Pro"
                className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
              <span className="absolute bottom-3 left-4 text-4xl font-black text-white/30 leading-none select-none">01</span>
            </div>
            <div className="p-5">
              <h3 className="font-black text-slate-900 dark:text-white">Crear cuenta</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                Alta en 2 minutos. Elige tu plan, configura tu agencia y activa tu color de marca. Sin tarjeta para empezar.
              </p>
            </div>
          </div>

          {/* Step 2 — Subir propiedad */}
          <div className="motion-story-card group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
            <div className="relative overflow-hidden" style={{ paddingBottom: '66.6%' }}>
              <img
                src="/images/story-agency-upload.webp"
                alt="Agente subiendo propiedad con tablet en villa"
                className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
              <span className="absolute bottom-3 left-4 text-4xl font-black text-white/30 leading-none select-none">02</span>
            </div>
            <div className="p-5">
              <h3 className="font-black text-slate-900 dark:text-white">Inscribir propiedad</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                Sube el panorama 360°, vídeo hero, fotos y datos. La plataforma procesa y genera el tour automáticamente.
              </p>
            </div>
          </div>

          {/* Step 3 — Personalizar */}
          <div className="motion-story-card group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
            <div className="relative overflow-hidden" style={{ paddingBottom: '66.6%' }}>
              <img
                src="/images/story-agency-configure.webp"
                alt="Agente configurando hotspots y personalización"
                className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
              <span className="absolute bottom-3 left-4 text-4xl font-black text-white/30 leading-none select-none">03</span>
            </div>
            <div className="p-5">
              <h3 className="font-black text-slate-900 dark:text-white">Personalizar y enriquecer</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                Añade hotspots por estancia, storytelling, Gaussian viewer, vídeo y tu marca. Todo desde el editor visual.
              </p>
            </div>
          </div>

          {/* Step 4 — Publicar */}
          <div className="motion-story-card group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
            <div className="relative overflow-hidden" style={{ paddingBottom: '66.6%' }}>
              <img
                src="/images/story-agency-publish.webp"
                alt="Agente compartiendo tour publicado por WhatsApp"
                className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
              <span className="absolute bottom-3 left-4 text-4xl font-black text-white/30 leading-none select-none">04</span>
            </div>
            <div className="p-5">
              <h3 className="font-black text-slate-900 dark:text-white">Publicar y compartir</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                Un link. Un QR. Un botón de WhatsApp. Tu tour inmersivo llega a cualquier móvil en segundos, sin apps.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          STORYTELLING B — Lo que sienten tus clientes
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="mt-16 mb-4" aria-label="La experiencia de tus clientes">
        <div className="motion-story-b overflow-hidden rounded-3xl bg-slate-900 shadow-2xl">
          {/* Two images side by side */}
          <div className="grid sm:grid-cols-2">
            <div className="relative min-h-[260px] overflow-hidden sm:min-h-[340px]">
              <img
                src="/images/story-client-discovery.webp"
                alt="Pareja descubriendo su casa ideal a través de Immersphere"
                className="motion-story-b-img h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-5">
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-widest text-white/70 backdrop-blur-sm">
                  El momento del descubrimiento
                </span>
              </div>
            </div>
            <div className="relative min-h-[260px] overflow-hidden sm:min-h-[340px]">
              <img
                src="/images/story-client-dream.webp"
                alt="Pareja emocionada al encontrar su casa de los sueños"
                className="motion-story-b-img h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-5">
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-widest text-white/70 backdrop-blur-sm">
                  "Es esta. Es nuestra casa."
                </span>
              </div>
            </div>
          </div>

          {/* Copy section */}
          <div className="px-8 py-10 text-center md:px-16">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-400">El valor real que generas</p>
            <h2 className="mx-auto mt-3 max-w-2xl text-2xl font-black leading-tight text-white sm:text-3xl">
              Tu próximo cliente ya está imaginándose en esa casa.
              <br />
              <span className="text-violet-300">¿Le has dado la experiencia que merece?</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-slate-400">
              Cuando un comprador entra al tour de una de tus propiedades, no está viendo fotos.
              Está caminando por los espacios, imaginando su vida allí, tomando decisiones.
              Immersphere convierte esa visita virtual en una conversación real contigo.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href="/properties"
                className="flex items-center gap-2 rounded-2xl bg-violet-600 px-6 py-3 text-sm font-black text-white transition hover:bg-violet-500 active:scale-[0.98]"
              >
                Publicar mi primera propiedad
              </a>
              <a
                href="tel:+34629554870"
                className="flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-6 py-3 text-sm font-black text-white backdrop-blur-sm transition hover:bg-white/20 active:scale-[0.98]"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.07 1.18 2 2 0 012.07.03h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11l-1.27 1.27a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7a2 2 0 011.72 2.01z"/></svg>
                Hablar con nosotros · 629 554 870
              </a>
            </div>
          </div>
        </div>
      </section>

    </main>
  );
}
