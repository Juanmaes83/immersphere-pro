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
    share_tour_suffix_3d: 'Tour inmersivo 3D',
    share_body: 'Explora el tour virtual inmersivo.',
    contact_whatsapp: 'Contactar por WhatsApp',
    share_btn: '↗ Compartir tour',
    share_copy_link: '🔗 Copiar link del tour',
    share_link_copied: '✓ Link copiado',
    share_download: '↓ Descargar tour',
    share_generating: 'Generando ZIP…',
    share_copy_iframe: '</> Copiar código iframe',
    share_iframe_copied: '✓ Código copiado',
    share_mobile_view: '📱 Ver en móvil',
    tour_no_asset: 'Esta propiedad no tiene archivos exportables todavía. Sube un asset primero.',
    tour_export_error: 'Error al generar el tour. Inténtalo de nuevo.',
    tour_network_error: 'Error de conexión al generar el tour.',

    // ── Gaussian Splat viewer ─────────────────────────────────────────────
    splat_loading: 'Cargando experiencia 3D…',
    splat_loading_slow: 'Esto puede tardar unos segundos más',
    splat_unavailable: 'Vista inmersiva no disponible',
    splat_unavailable_body: 'No hemos podido cargar esta vista. Por favor, inténtalo de nuevo.',
    splat_retry: 'Reintentar',
    splat_format_error: 'Formato no soportado. Usa .ply o .splat.',
    splat_upload_cta: 'Subir .ply o .splat',
    splat_upload_hint: 'Haz clic o arrastra el archivo aquí',
    splat_controls_hint: 'WASD + ratón para navegar',
    splat_admin_title: 'Gaussian Splat Editor',
    splat_admin_subtitle: 'Previsualización, edición básica y conexión con SuperSplat',
    splat_local_asset: 'Asset local',
    splat_basic_editor: 'Editor básico',
    splat_editor_loading_hint: 'Disponible cuando el splat termine de cargar.',
    splat_editor_no_file_hint: 'Sube un archivo .splat local para activar el editor.',
    splat_select_gaussians: 'Seleccionar gaussianas',
    splat_exit_selection: 'Salir de selección',
    splat_enable_clip: 'Activar plano de clipping',
    splat_disable_clip: 'Desactivar clipping',
    splat_reset: 'Reset editor',
    splat_open_supersplat: 'Editar en SuperSplat →',
    splat_preview_supersplat: 'Previsualizar en SuperSplat →',
    splat_supersplat_note: 'Guarda y vuelve a subir el resultado',
    splat_zones_label: 'Zonas ocultadas',
    splat_editor_note: 'Editor experimental conectado a flujo SuperSplat. Las zonas eliminadas usan esferas SDF con opacidad 0.',
    splat_tab_file: 'Archivo',
    splat_tab_editor: 'Editor',
    splat_capture_hint: 'Captura con Luma AI · Polycam · Postshot',
    splat_admin_fallback_title: 'Sube tu Gaussian Splat',
    splat_admin_fallback_body: 'Sube tu propio .splat o .ply para verlo aquí.',
    splat_admin_upload_label: 'Subir archivo local',

    // ── Gaussian UX Lite (Micro-PR 5) ─────────────────────────────────────
    splat_onboarding_drag: 'Arrastra para explorar',
    splat_onboarding_swipe: 'Desliza para explorar',
    splat_mode_explore: 'Explorar',
    splat_mode_walk: 'Recorrer',
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
    share_tour_suffix_3d: 'Immersive 3D tour',
    share_body: 'Explore the virtual immersive tour.',
    contact_whatsapp: 'Contact on WhatsApp',
    share_btn: '↗ Share tour',
    share_copy_link: '🔗 Copy tour link',
    share_link_copied: '✓ Link copied',
    share_download: '↓ Download tour',
    share_generating: 'Generating ZIP…',
    share_copy_iframe: '</> Copy iframe code',
    share_iframe_copied: '✓ Code copied',
    share_mobile_view: '📱 View on mobile',
    tour_no_asset: 'This property has no exportable files yet. Upload an asset first.',
    tour_export_error: 'Error generating tour. Please try again.',
    tour_network_error: 'Connection error generating tour.',

    // ── Gaussian Splat viewer ─────────────────────────────────────────────
    splat_loading: 'Loading 3D experience…',
    splat_loading_slow: 'This may take a few more seconds',
    splat_unavailable: 'Immersive view unavailable',
    splat_unavailable_body: 'We could not load this view. Please try again.',
    splat_retry: 'Try again',
    splat_format_error: 'Unsupported format. Use .ply or .splat.',
    splat_upload_cta: 'Upload .ply or .splat',
    splat_upload_hint: 'Click or drag the file here',
    splat_controls_hint: 'WASD + mouse to navigate',
    splat_admin_title: 'Gaussian Splat Editor',
    splat_admin_subtitle: 'Preview, basic editing and SuperSplat integration',
    splat_local_asset: 'Local asset',
    splat_basic_editor: 'Basic editor',
    splat_editor_loading_hint: 'Available once the splat has finished loading.',
    splat_editor_no_file_hint: 'Upload a local .splat file to activate the editor.',
    splat_select_gaussians: 'Select Gaussians',
    splat_exit_selection: 'Exit selection',
    splat_enable_clip: 'Enable clipping plane',
    splat_disable_clip: 'Disable clipping',
    splat_reset: 'Reset editor',
    splat_open_supersplat: 'Edit in SuperSplat →',
    splat_preview_supersplat: 'Preview in SuperSplat →',
    splat_supersplat_note: 'Save and re-upload the result',
    splat_zones_label: 'Hidden zones',
    splat_editor_note: 'Experimental editor connected to SuperSplat flow. Removed zones use SDF spheres with opacity 0.',
    splat_tab_file: 'File',
    splat_tab_editor: 'Editor',
    splat_capture_hint: 'Capture with Luma AI · Polycam · Postshot',
    splat_admin_fallback_title: 'Upload your Gaussian Splat',
    splat_admin_fallback_body: 'Upload your own .splat or .ply to view it here.',
    splat_admin_upload_label: 'Upload local file',

    // ── Gaussian UX Lite (Micro-PR 5) ─────────────────────────────────────
    splat_onboarding_drag: 'Drag to explore',
    splat_onboarding_swipe: 'Swipe to explore',
    splat_mode_explore: 'Explore',
    splat_mode_walk: 'Walk',
  }
} as const;
