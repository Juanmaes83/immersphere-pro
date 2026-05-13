import { useCallback, useEffect, useRef, useState } from 'react';
import LeadCaptureModal from '@/components/viewer/LeadCaptureModal';

interface ChatbotWidgetProps {
  propertyId: string;
  propertyTitle: string;
  tenantPhone: string;
  primaryColor?: string;
}

interface Message {
  role: 'bot' | 'user';
  text: string;
  cta?: 'contact';
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function hasAny(input: string, words: string[]): boolean {
  const n = normalize(input);
  return words.some((w) => n.includes(w));
}

function getReply(input: string): { text: string; cta?: 'contact' } {
  if (hasAny(input, ['precio', 'cuesta', 'vale', 'coste', 'costar', 'euro', 'eur'])) {
    return { text: 'El precio está indicado en la ficha de la propiedad. ¿Quieres que un agente te contacte para hablar de condiciones?' };
  }
  if (hasAny(input, ['habitacion', 'dormitorio', 'cuarto', 'bano', 'aseo', 'garaje', 'terraza', 'piscina', 'metro', 'superficie', 'm2'])) {
    return { text: 'Puedes ver todos los detalles de habitaciones, superficies y zonas en la ficha completa de la propiedad. ¿Necesitas más información?' };
  }
  if (hasAny(input, ['zona', 'barrio', 'ubicacion', 'ubicar', 'donde', 'localizacion', 'cerca', 'colegio', 'transporte', 'metro', 'bus'])) {
    return { text: 'Puedes ver la ubicación exacta y el mapa en la ficha de la propiedad. ¿Quieres que te expliquemos más sobre el entorno?' };
  }
  if (hasAny(input, ['visita', 'ver', 'cita', 'reservar', 'agendar', 'cuando', 'disponibilidad', 'horario', 'quedar'])) {
    return { text: '¡Perfecto! Podemos organizar una visita. Rellena el formulario o llámanos directamente:', cta: 'contact' };
  }
  if (hasAny(input, ['contactar', 'contacto', 'agente', 'hablar', 'llamar', 'email', 'correo', 'whatsapp'])) {
    return { text: 'Puedes contactar con nosotros a través del formulario o directamente por teléfono:', cta: 'contact' };
  }
  if (hasAny(input, ['hola', 'buenas', 'buenos', 'hey', 'saludos', 'ola'])) {
    return { text: '¡Hola! Soy el asistente de esta propiedad. ¿En qué puedo ayudarte? Puedo resolver dudas sobre precio, habitaciones, ubicación o concertar una visita.' };
  }
  if (hasAny(input, ['gracias', 'ok', 'perfecto', 'genial', 'bien', 'adios', 'hasta'])) {
    return { text: '¡De nada! Si tienes más preguntas, aquí estaré. ¡Que tengas un buen día!' };
  }
  return { text: 'No estoy seguro de haber entendido bien tu pregunta. Puedo ayudarte con dudas sobre precio, habitaciones, zona, visitas o contacto con el agente.' };
}

const WELCOME: Message = {
  role: 'bot',
  text: '¡Hola! Soy el asistente de esta propiedad. Pregúntame sobre precio, habitaciones, zona o reserva una visita.'
};

export default function ChatbotWidget({
  propertyId,
  propertyTitle,
  tenantPhone,
  primaryColor = '#7C3AED'
}: ChatbotWidgetProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [showLead, setShowLead] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, messages]);

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

  function send(): void {
    const text = input.trim();
    if (!text) return;
    setInput('');
    const reply = getReply(text);
    setMessages((prev) => [
      ...prev,
      { role: 'user', text },
      { role: 'bot', text: reply.text, cta: reply.cta }
    ]);
  }

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        aria-label="Abrir chatbot"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-[9990] flex h-14 w-14 items-center justify-center rounded-full shadow-xl transition-transform hover:scale-105 focus:outline-none"
        style={{ backgroundColor: primaryColor }}
      >
        {open ? (
          <span className="text-xl font-black text-white">✕</span>
        ) : (
          <span className="text-2xl">💬</span>
        )}
      </button>

      {/* Chat panel */}
      {open ? (
        <div
          ref={panelRef}
          className="fixed bottom-24 right-5 z-[9990] flex w-[320px] flex-col overflow-hidden rounded-[1.4rem] bg-slate-900 text-white shadow-2xl"
          style={{ height: '400px' }}
        >
          {/* Header */}
          <div
            className="shrink-0 px-5 py-4"
            style={{ backgroundColor: primaryColor }}
          >
            <p className="text-xs font-black uppercase tracking-[0.18em] text-white/70">Asistente</p>
            <p className="mt-0.5 text-sm font-black leading-tight">{propertyTitle}</p>
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'rounded-br-md text-white'
                    : 'rounded-bl-md bg-white/10 text-white/90'
                }`} style={msg.role === 'user' ? { backgroundColor: primaryColor } : undefined}>
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
                      ) : null}
                      <button
                        type="button"
                        onClick={() => { setOpen(false); setShowLead(true); }}
                        className="flex items-center justify-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-xs font-black text-white transition hover:bg-white/25"
                      >
                        📅 Concertar visita
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
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
                onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
                placeholder="Escribe tu pregunta..."
                className="flex-1 rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-2.5 text-sm font-semibold text-white placeholder:text-white/30 outline-none focus:border-white/30 focus:bg-white/10"
              />
              <button
                type="button"
                onClick={send}
                disabled={!input.trim()}
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
      {showLead ? (
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
