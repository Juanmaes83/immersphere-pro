import { useEffect, useRef, useState } from 'react';
import { t } from '@/i18n/dictionary';

interface LeadCaptureModalProps {
  propertyId: string;
  hotspotLabel: string;
  primaryColor: string;
  agencyName?: string;
  lang?: string;
  context?: Record<string, string | undefined>;
  onClose: () => void;
  onSubmitted: () => void;
}

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ??
  import.meta.env.VITE_API_URL ??
  'http://localhost:4000/api'
).replace(/\/$/, '');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LeadCaptureModal({
  propertyId,
  hotspotLabel,
  primaryColor,
  agencyName,
  lang,
  context,
  onClose,
  onSubmitted
}: LeadCaptureModalProps): JSX.Element {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [state, setState] = useState<SubmitState>('idle');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setFieldError(null);

    if (!EMAIL_RE.test(email.trim())) {
      setFieldError(t(lang, 'email_error'));
      return;
    }

    setState('submitting');

    try {
      const res = await fetch(`${API_BASE}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          email: email.trim(),
          phone: phone.trim() || undefined,
          notes: notes.trim() || undefined,
          source: context?.source || 'viewer_cta',
          ...context,
          origin: context?.origin || window.location.origin,
          referrer: context?.referrer || document.referrer || undefined
        })
      });

      if (!res.ok) {
        setState('error');
        return;
      }

      setState('success');
      onSubmitted();
    } catch {
      setState('error');
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-[1.6rem] bg-slate-900 text-white shadow-2xl">
        {/* Header */}
        <div className="border-b border-white/10 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p
                className="text-xs font-black uppercase tracking-[0.2em]"
                style={{ color: agencyName ? primaryColor : '#a78bfa' }}
              >
                {agencyName ?? t(lang, 'contact_request')}
              </p>
              {agencyName ? (
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35 mt-0.5">
                  {t(lang, 'contact_request')}
                </p>
              ) : null}
              <h2 className="mt-1 text-xl font-black leading-snug">{hotspotLabel}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-full p-2 text-white/40 transition hover:bg-white/10 hover:text-white"
              aria-label={t(lang, 'close')}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {state === 'success' ? (
            <div className="py-6 text-center">
              <div
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-full text-3xl"
                style={{ backgroundColor: primaryColor + '33' }}
              >
                ✓
              </div>
              <h3 className="mt-5 text-2xl font-black">{t(lang, 'received_title')}</h3>
              <p className="mt-3 text-sm leading-6 text-white/60">
                {t(lang, 'received_body')}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-6 rounded-full px-6 py-3 text-sm font-black text-white transition hover:opacity-90"
                style={{ backgroundColor: primaryColor }}
              >
                {t(lang, 'close')}
              </button>
            </div>
          ) : (
            <form onSubmit={(e) => { void handleSubmit(e); }} noValidate>
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-white/50">
                    {t(lang, 'email_label')}
                  </label>
                  <input
                    ref={emailRef}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t(lang, 'email_placeholder')}
                    required
                    disabled={state === 'submitting'}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3 text-sm font-semibold text-white placeholder:text-white/25 outline-none focus:border-violet-500 focus:bg-white/10 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-white/50">
                    {t(lang, 'phone_label')}
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={t(lang, 'phone_placeholder')}
                    disabled={state === 'submitting'}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3 text-sm font-semibold text-white placeholder:text-white/25 outline-none focus:border-violet-500 focus:bg-white/10 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-white/50">
                    {t(lang, 'message_label')}
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t(lang, 'message_placeholder')}
                    rows={3}
                    disabled={state === 'submitting'}
                    className="w-full resize-none rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3 text-sm font-semibold text-white placeholder:text-white/25 outline-none focus:border-violet-500 focus:bg-white/10 disabled:opacity-50"
                  />
                </div>

                {fieldError ? (
                  <p className="text-sm font-bold text-red-400">{fieldError}</p>
                ) : null}

                {state === 'error' ? (
                  <p className="text-sm font-bold text-red-400">
                    {t(lang, 'send_error')}
                  </p>
                ) : null}
              </div>

              <button
                type="submit"
                disabled={state === 'submitting'}
                className="mt-5 w-full rounded-2xl px-5 py-4 text-sm font-black text-white transition hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: primaryColor }}
              >
                {state === 'submitting' ? t(lang, 'sending') : t(lang, 'submit_cta')}
              </button>

              <p className="mt-3 text-center text-xs text-white/30">
                {t(lang, 'privacy_note')}
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
