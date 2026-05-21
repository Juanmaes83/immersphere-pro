import { useCallback, useEffect, useRef, useState } from 'react';
import LeadCaptureModal from '@/components/viewer/LeadCaptureModal';

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ??
  import.meta.env.VITE_API_URL ??
  'http://localhost:4000/api'
).replace(/\/$/, '');

interface ChatbotWidgetProps {
  propertyId?: string;
  propertyTitle?: string;
  tenantPhone?: string;
  primaryColor?: string;
  /** When true shows as platform guide (no property context) */
  platformMode?: boolean;
}

interface Message {
  role: 'bot' | 'user';
  text: string;
  cta?: 'contact';
}

interface ApiMessage {
  role: 'user' | 'assistant';
  content: string;
}

async function askVera(history: ApiMessage[], propertyId?: string): Promise<string> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: history, propertyId })
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? 'Error desconocido');
  }

  const body = await res.json() as { success: boolean; data: { reply: string } };
  return body.data.reply;
}

const CONTACT_TRIGGERS = [
  'visita', 'llamar', 'llamada', 'contactar', 'agente', 'quedar',
  'cita', 'reservar', 'agendar', 'whatsapp', 'teléfono', 'telefono',
  '+34 629', '629 554'
];

function hasCta(text: string): boolean {
  const lower = text.toLowerCase();
  return CONTACT_TRIGGERS.some((t) => lower.includes(t));
}

const PLATFORM_WELCOME: Message = {
  role: 'bot',
  text: 'Hola, soy Vera. ¿En qué puedo ayudarte? Puedo explicarte cómo funciona Immersphere, qué plan encaja con tu agencia o resolver cualquier duda técnica.'
};

const PROPERTY_WELCOME: Message = {
  role: 'bot',
  text: 'Hola, soy Vera. Cuéntame qué te interesa saber sobre esta propiedad, o si quieres organizar una visita.'
};

export default function ChatbotWidget({
  propertyId,
  propertyTitle,
  tenantPhone,
  primaryColor = '#7C3AED',
  platformMode = false
}: ChatbotWidgetProps): JSX.Element {
  const welcome = platformMode ? PLATFORM_WELCOME : PROPERTY_WELCOME;

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([welcome]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [showLead, setShowLead] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, messages, isThinking]);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, handleClickOutside]);

  async function send(): Promise<void> {
    const text = input.trim();
    if (!text || isThinking) return;

    setInput('');
    const userMsg: Message = { role: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    setIsThinking(true);

    // Build history for the API (convert from UI messages, skip welcome)
    const history: ApiMessage[] = messages
      .slice(1) // skip welcome bot message
      .concat(userMsg)
      .map((m) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.text
      }));

    try {
      const reply = await askVera(history, propertyId);
      const cta = hasCta(reply) ? 'contact' : undefined;
      setMessages((prev) => [...prev, { role: 'bot', text: reply, cta }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'bot', text: 'No pude procesar tu mensaje. Inténtalo de nuevo.' }
      ]);
    } finally {
      setIsThinking(false);
    }
  }

  const headerLabel = platformMode ? 'Vera — Immersphere Pro' : (propertyTitle ?? 'Asistente');

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        aria-label="Abrir asistente Vera"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-[10000] flex h-14 w-14 items-center justify-center rounded-full shadow-xl transition-transform hover:scale-105 focus:outline-none"
        style={{ backgroundColor: primaryColor }}
      >
        {open ? (
          <span className="text-xl font-black text-white">✕</span>
        ) : (
          <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {open ? (
        <div
          ref={panelRef}
          className="fixed bottom-24 right-5 z-[10000] flex w-[340px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-[1.4rem] bg-slate-900 text-white shadow-2xl"
          style={{ height: 'min(460px, calc(100dvh - 8rem))' }}
        >
          {/* Header */}
          <div className="shrink-0 px-5 py-4" style={{ backgroundColor: primaryColor }}>
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs font-black text-white">
                V
              </div>
              <div>
                <p className="text-sm font-black leading-tight text-white">{headerLabel}</p>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/60">Asistente IA · Immersphere</p>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'rounded-br-md text-white'
                      : 'rounded-bl-md bg-white/10 text-white/90'
                  }`}
                  style={msg.role === 'user' ? { backgroundColor: primaryColor } : undefined}
                >
                  {msg.text}
                  {msg.cta === 'contact' ? (
                    <div className="mt-3 flex flex-col gap-2">
                      {tenantPhone ? (
                        <a
                          href={`tel:${tenantPhone.replace(/\s/g, '')}`}
                          className="flex items-center justify-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-xs font-black text-white transition hover:bg-white/25"
                        >
                          📞 Llamar ahora
                        </a>
                      ) : (
                        <a
                          href="tel:+34629554870"
                          className="flex items-center justify-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-xs font-black text-white transition hover:bg-white/25"
                        >
                          📞 Hablar con el equipo
                        </a>
                      )}
                      {propertyId ? (
                        <button
                          type="button"
                          onClick={() => { setOpen(false); setShowLead(true); }}
                          className="flex items-center justify-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-xs font-black text-white transition hover:bg-white/25"
                        >
                          📅 Concertar visita
                        </button>
                      ) : (
                        <a
                          href="https://wa.me/34629554870"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-xs font-black text-white transition hover:bg-white/25"
                        >
                          💬 WhatsApp directo
                        </a>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isThinking ? (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-white/10 px-4 py-3">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/60" style={{ animationDelay: '0ms' }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/60" style={{ animationDelay: '150ms' }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/60" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            ) : null}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="shrink-0 border-t border-white/10 px-3 py-3">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { void send(); } }}
                placeholder="Escribe tu pregunta..."
                disabled={isThinking}
                className="flex-1 rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-2.5 text-sm font-semibold text-white placeholder:text-white/30 outline-none focus:border-white/30 focus:bg-white/10 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => { void send(); }}
                disabled={!input.trim() || isThinking}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-black text-white transition hover:opacity-80 disabled:opacity-30"
                style={{ backgroundColor: primaryColor }}
              >
                ↑
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Lead capture modal triggered by chatbot CTA */}
      {showLead && propertyId ? (
        <LeadCaptureModal
          propertyId={propertyId}
          hotspotLabel="Concertar visita"
          primaryColor={primaryColor}
          onClose={() => setShowLead(false)}
          onSubmitted={() => setShowLead(false)}
        />
      ) : null}
    </>
  );
}
