/**
 * Lightweight property-level i18n.
 *
 * Design constraints (PR5 spec):
 *  - No react-i18next / next-intl / formatjs
 *  - No global language selector
 *  - Only system UI strings — never editorial content (storySubheadline, ctaLabel, hotspot body…)
 *  - Language is per-property: property.language = 'es' | 'en', default 'es'
 *  - Helper t(lang, key) never returns undefined — falls back to 'es', then to the key itself
 */

export type Lang = 'es' | 'en';

// Accepted language values — anything else normalises to 'es'
const VALID_LANGS: ReadonlySet<string> = new Set(['es', 'en']);

export function normaliseLang(raw: string | undefined | null): Lang {
  return VALID_LANGS.has(raw as string) ? (raw as Lang) : 'es';
}

// ── String interpolation helper ─────────────────────────────────────────────
// Usage: t(lang, 'space_of', { n: 2, m: 5 }) → "Estancia 2 de 5"
export function t(
  lang: string | undefined | null,
  key: string,
  vars?: Record<string, string | number>
): string {
  const l = normaliseLang(lang);
  const val: string =
    (dict[l] as Record<string, string>)[key] ??
    (dict.es as Record<string, string>)[key] ??
    key;

  if (!vars) return val;

  return Object.entries(vars).reduce(
    (s, [k, v]) => s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)),
    val
  );
}

// ── Dictionary ───────────────────────────────────────────────────────────────
export const dict = {
  es: {
    // ── Loading / system labels ───────────────────────────────────────────
    immersive_experience: 'Experiencia inmersiva',
    immersive_tour: 'Recorrido inmersivo',

    // ── Empty state ───────────────────────────────────────────────────────
    no_spaces: 'Sin estancias configuradas',
    no_spaces_body: 'Esta propiedad necesita al menos una estancia y un asset para activar el visor.',

    // ── Error boundary ────────────────────────────────────────────────────
    viewer_error: 'Error al cargar el visor',
    viewer_error_body: 'No pudimos cargar el visor. Inténtalo de nuevo.',
    retry: 'Reintentar',

    // ── Asset types ───────────────────────────────────────────────────────
    panorama_360: 'Panorama 360°',
    immersive_view: 'Vista inmersiva',
    model_3d: 'Modelo 3D',
    loading_3d: 'Cargando modelo 3D...',

    // ── Header buttons ────────────────────────────────────────────────────
    tour_btn: '▶ Tour',
    cinematic_btn: 'Cinematic',
    floorplan_open: '🗺 Plano',
    floorplan_back: '← Recorrido',
    fullscreen_enter: 'Pantalla completa',
    fullscreen_exit: 'Salir de pantalla completa',
    cinematic_auto_title: 'Recorrido automático cinematográfico',
    tools_title: 'Herramientas',

    // ── Cinematic controls (header) ───────────────────────────────────────
    cinematic_live: '● Cinematic',
    cinematic_paused_label: 'Cinematic · En pausa',
    pause_header: '⏸ Pausa',
    resume_header: '▶ Reanudar',
    stop_tour: '✕ Salir',
    pause_tour_title: 'Pausar recorrido',
    resume_tour_title: 'Reanudar recorrido',

    // ── Guided tour (header) ──────────────────────────────────────────────
    guided_tour: 'Tour guiado',
    exit_tour_header: '✕ Salir del tour',

    // ── Aside — Cinematic panel ───────────────────────────────────────────
    space_of: 'Estancia {n} de {m}',
    cinematic_status_paused: 'Pausado',
    cinematic_status_auto: 'Auto',
    pause: '⏸ Pausar',
    resume: '▶ Reanudar',
    exit_journey: '✕ Salir del recorrido',

    // ── Aside — Guided tour panel ─────────────────────────────────────────
    prev_space: '← Anterior',
    next_space: 'Siguiente →',
    exit_tour: '✕ Salir del tour',
    request_info: 'Solicitar información',
    back_to_tour: '← Volver al tour',

    // ── Cinematic end screen ──────────────────────────────────────────────
    tour_complete: 'Recorrido completo',
    request_visit: 'Solicitar visita',
    explore_again: 'Explorar de nuevo',
    exit_journey_text: 'Salir del recorrido',

    // ── Advanced tools menu ───────────────────────────────────────────────
    measuring: 'Midiendo',
    measure_space: 'Medir espacio',
    story_on: 'Narrativa activa',
    story_off: 'Narrativa desact.',
    audio_muted: 'Silenciado',
    audio_active: 'Ambiente activo',

    // ── Aside — default panel ─────────────────────────────────────────────
    active_space_label: 'Estancia activa',
    information: 'Información',
    metric_label: 'Dato',
    next_step: 'Próximo paso',
    select_hotspot: 'Selecciona un punto del espacio para ver detalles',
    explore_360: 'Explora la estancia con el visor 360°',

    // ── Mobile hotspot sheet ──────────────────────────────────────────────
    featured_point: 'Punto destacado',
    close: 'Cerrar',

    // ── Space dimensions ──────────────────────────────────────────────────
    dim_width: 'ancho',
    dim_height: 'altura',
    dim_depth: 'fondo',

    // ── Lead capture modal ────────────────────────────────────────────────
    contact_request: 'Solicitud de contacto',
    received_title: '¡Recibido!',
    received_body: 'Tu solicitud ha sido registrada. Un agente se pondrá en contacto contigo pronto.',
    email_label: 'Email *',
    email_placeholder: 'tu@email.com',
    phone_label: 'Teléfono',
    phone_placeholder: '+34 600 000 000',
    message_label: 'Mensaje',
    message_placeholder: 'Estoy interesado en esta propiedad...',
    email_error: 'Introduce un email válido.',
    send_error: 'No se ha podido enviar. Inténtalo de nuevo.',
    sending: 'Enviando…',
    submit_cta: 'Solicitar información',
    privacy_note: 'Tus datos solo se usarán para contactarte sobre esta propiedad.',

    // ── QR widget ────────────────────────────────────────────────────────
    qr_label: 'QR · Tour inmersivo',
    qr_scan_to_open: 'Escanea para abrir el tour',
    qr_download: '↓ Descargar PNG',
    qr_fullscreen_title: 'Pantalla completa para reuniones',
    qr_modal_title_fallback: 'Tour inmersivo',
    qr_modal_subtitle: 'Escanea y recorre la vivienda desde tu móvil',
    qr_modal_tagline: 'Experiencia inmersiva · Tour virtual 360°',
    qr_link_copied: '✓ Enlace copiado',
    qr_copy_link: '🔗 Copiar enlace',

    // ── Property stats ────────────────────────────────────────────────────
    stat_price: 'Precio',
    stat_area: 'Superficie',
    stat_rooms: 'Habitaciones',
    stat_bathrooms: 'Baños',

    // ── Floorplan ─────────────────────────────────────────────────────────
    floorplan_alt: 'Plano de la vivienda',
    floorplan_no_pins: 'Sin pins configurados',
    floorplan_no_pins_help: 'Asigna coordenadas x/y a cada estancia desde el panel de administración',

    // ── Sharing ───────────────────────────────────────────────────────────
    share_tour_suffix: 'Tour inmersivo 360°',
    share_body: 'Explora el tour virtual inmersivo.',
    contact_whatsapp: 'Contactar por WhatsApp',
  },

  en: {
    // ── Loading / system labels ───────────────────────────────────────────
    immersive_experience: 'Immersive experience',
    immersive_tour: 'Immersive tour',

    // ── Empty state ───────────────────────────────────────────────────────
    no_spaces: 'No spaces configured',
    no_spaces_body: 'This property needs at least one space and an asset to activate the viewer.',

    // ── Error boundary ────────────────────────────────────────────────────
    viewer_error: 'Error loading viewer',
    viewer_error_body: 'We could not load the viewer. Please try again.',
    retry: 'Try again',

    // ── Asset types ───────────────────────────────────────────────────────
    panorama_360: '360° panorama',
    immersive_view: 'Immersive view',
    model_3d: '3D model',
    loading_3d: 'Loading 3D model...',

    // ── Header buttons ────────────────────────────────────────────────────
    tour_btn: '▶ Tour',
    cinematic_btn: 'Cinematic',
    floorplan_open: '🗺 Floorplan',
    floorplan_back: '← Tour',
    fullscreen_enter: 'Fullscreen',
    fullscreen_exit: 'Exit fullscreen',
    cinematic_auto_title: 'Automatic cinematic tour',
    tools_title: 'Tools',

    // ── Cinematic controls (header) ───────────────────────────────────────
    cinematic_live: '● Cinematic',
    cinematic_paused_label: 'Cinematic · Paused',
    pause_header: '⏸ Pause',
    resume_header: '▶ Resume',
    stop_tour: '✕ Exit',
    pause_tour_title: 'Pause tour',
    resume_tour_title: 'Resume tour',

    // ── Guided tour (header) ──────────────────────────────────────────────
    guided_tour: 'Guided tour',
    exit_tour_header: '✕ Exit tour',

    // ── Aside — Cinematic panel ───────────────────────────────────────────
    space_of: 'Room {n} of {m}',
    cinematic_status_paused: 'Paused',
    cinematic_status_auto: 'Auto',
    pause: '⏸ Pause',
    resume: '▶ Resume',
    exit_journey: '✕ Exit tour',

    // ── Aside — Guided tour panel ─────────────────────────────────────────
    prev_space: '← Previous',
    next_space: 'Next →',
    exit_tour: '✕ Exit tour',
    request_info: 'Request information',
    back_to_tour: '← Back to tour',

    // ── Cinematic end screen ──────────────────────────────────────────────
    tour_complete: 'Tour complete',
    request_visit: 'Request visit',
    explore_again: 'Explore again',
    exit_journey_text: 'Exit tour',

    // ── Advanced tools menu ───────────────────────────────────────────────
    measuring: 'Measuring',
    measure_space: 'Measure space',
    story_on: 'Story mode on',
    story_off: 'Story mode off',
    audio_muted: 'Muted',
    audio_active: 'Ambient on',

    // ── Aside — default panel ─────────────────────────────────────────────
    active_space_label: 'Current space',
    information: 'Information',
    metric_label: 'Detail',
    next_step: 'Next step',
    select_hotspot: 'Select a point of interest to see details',
    explore_360: 'Explore this space in 360°',

    // ── Mobile hotspot sheet ──────────────────────────────────────────────
    featured_point: 'Highlight',
    close: 'Close',

    // ── Space dimensions ──────────────────────────────────────────────────
    dim_width: 'width',
    dim_height: 'height',
    dim_depth: 'depth',

    // ── Lead capture modal ────────────────────────────────────────────────
    contact_request: 'Contact request',
    received_title: 'Received!',
    received_body: 'Your request has been registered. An agent will get in touch with you shortly.',
    email_label: 'Email *',
    email_placeholder: 'your@email.com',
    phone_label: 'Phone',
    phone_placeholder: '+44 7700 000000',
    message_label: 'Message',
    message_placeholder: 'I am interested in this property...',
    email_error: 'Please enter a valid email address.',
    send_error: 'Could not send. Please try again.',
    sending: 'Sending…',
    submit_cta: 'Request information',
    privacy_note: 'Your data will only be used to contact you about this property.',

    // ── QR widget ────────────────────────────────────────────────────────
    qr_label: 'QR · Immersive tour',
    qr_scan_to_open: 'Scan to open the tour',
    qr_download: '↓ Download PNG',
    qr_fullscreen_title: 'Fullscreen for presentations',
    qr_modal_title_fallback: 'Immersive tour',
    qr_modal_subtitle: 'Scan and explore the property from your phone',
    qr_modal_tagline: 'Immersive experience · 360° virtual tour',
    qr_link_copied: '✓ Link copied',
    qr_copy_link: '🔗 Copy link',

    // ── Property stats ────────────────────────────────────────────────────
    stat_price: 'Price',
    stat_area: 'Area',
    stat_rooms: 'Bedrooms',
    stat_bathrooms: 'Bathrooms',

    // ── Floorplan ─────────────────────────────────────────────────────────
    floorplan_alt: 'Property floorplan',
    floorplan_no_pins: 'No pins configured',
    floorplan_no_pins_help: 'Assign x/y coordinates to each space from the admin panel',

    // ── Sharing ───────────────────────────────────────────────────────────
    share_tour_suffix: 'Immersive 360° tour',
    share_body: 'Explore the virtual immersive tour.',
    contact_whatsapp: 'Contact on WhatsApp',
  }
} as const;
