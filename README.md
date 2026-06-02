# Immersphere Pro

Plataforma SaaS multi-tenant para crear, publicar y vender tours virtuales inmersivos de propiedades, espacios y proyectos. Compatible con imágenes 360°, Gaussian Splat volumétrico y modelos 3D.

**Producción:** https://immersphere-pro.vercel.app  
**Idea y dirección:** Rubik Sota · 629 554 870

---

## Índice

1. [¿Qué es Immersphere Pro?](#qué-es-immersphere-pro)
2. [Funcionalidades principales](#funcionalidades-principales)
3. [Para inmobiliarias](#para-inmobiliarias)
4. [Para constructoras y promotoras](#para-constructoras-y-promotoras)
5. [Para decoradores e interioristas](#para-decoradores-e-interioristas)
6. [Vera — Asistente IA](#vera--asistente-ia)
7. [Planes y precios](#planes-y-precios)
8. [Stack técnico](#stack-técnico)
9. [Variables de entorno](#variables-de-entorno)
10. [Instalación y desarrollo local](#instalación-y-desarrollo-local)

---

## ¿Qué es Immersphere Pro?

Immersphere Pro permite a agencias inmobiliarias, constructoras, promotoras y estudios de interiorismo publicar tours virtuales 3D de sus espacios. El cliente final solo necesita un navegador — sin apps, sin plugins, sin registros.

**Lo que diferencia la plataforma:**

- **Tours en 3 formatos:** imagen 360°, Gaussian Splat volumétrico y mesh 3D (.glb)
- **Lead capture integrado:** cada tour captura email y teléfono del visitante directamente desde el visor
- **Analytics de comportamiento:** qué habitaciones interesan más, tiempo de permanencia, hotspots más clickados, engagement score
- **Hotspots contextuales:** puntos informativos dentro del visor con precio, m², materiales y CTA de contacto
- **Auto-tour cinematográfico:** recorrido automático entre espacios con transiciones cinemáticas
- **Vera IA:** asistente de inteligencia artificial que guía al visitante y genera llamadas comerciales
- **White-label completo:** logo, colores y dominio de la agencia sin marca Immersphere
- **Embed iframe:** cualquier agencia puede publicar su tour en su propia web
- **Multi-tenant:** cada empresa tiene su espacio aislado, propiedades y branding
- **Descarga offline:** tour exportable como ZIP para ferias y presentaciones sin internet

---

## Funcionalidades principales

### Visor universal
- Panorama 360° con arrastre inercial, pinch-zoom y giroscopio en móvil
- Gaussian Splat volumétrico con navegación libre en 3D
- Viewer GLB/3D con model-viewer
- Transiciones cinemáticas entre espacios (fade 400ms + drift)
- Minimap interactivo con pins de espacios
- Modo fullscreen con experiencia QR premium
- Modo WebXR para visores de realidad virtual
- Tour guiado automático con control de velocidad
- Vista isométrica dollhouse

### Hotspots
- Tipos: info, medición, CTA de contacto, navegación entre espacios
- Editor visual con drag-and-drop sobre el panorama
- Preview cards al hacer hover
- Zoom cinemático al hacer clic

### Lead capture y CRM
- Modal de captación de datos dentro del visor sin salir del tour
- CTA WhatsApp integrado en cada propiedad
- Panel de Leads con filtros, métricas, estados y notas de seguimiento
- Exportación CSV con un clic
- Notificación en tiempo real con badge de leads no leídos
- Email automático al capturar lead (Resend)
- Webhook configurable por tenant para CRM externos

### Analytics
- Eventos registrados: apertura del visor, cambio de espacio, clic en hotspot, CTA lead
- Resumen por propiedad: engagement score, top espacio, top hotspot
- Resumen por tenant: actividad global

### Sharing y distribución
- URL pública `/property/:id/:slug` con canonical SEO
- Open Graph tags con imagen de portada, precio y descripción
- Twitter Card automático
- QR descargable en PNG
- Iframe embebible en web externa (`/embed/:id`) — visor limpio sin navbar ni footer
- Sitemap.xml automático con todas las propiedades publicadas
- Schema.org JSON-LD RealEstateListing

### Contenido enriquecido
- Hero vídeo por propiedad (abre la ficha con vídeo comercial)
- Sección de barrio con Google Maps integrado
- Street View embebido
- Luma AI embed 3D
- Plano interactivo con pins de espacios
- Audio ambiente configurable por espacio

### Dashboard y gestión
- Dashboard con métricas diarias: leads, seguimientos, propiedades activas
- Avatar de perfil con dos modos: subir archivo o captura por webcam en tiempo real
- Panel de propiedades con acciones rápidas
- Wizard de creación guiada de propiedades
- Editor de dirección con geocoding automático
- Toggle publicar/despublicar con un clic
- Tour offline descargable en ZIP (HTML autónomo con viewer Three.js)
- Informe PDF descargable por propiedad

### Branding y white-label
- Color de marca con selector HSL y preview en tiempo real
- Logo de agencia (imagen o iniciales de texto)
- Texto de logo personalizable
- Eliminación de marca Immersphere (`removeBranding`)
- Número WhatsApp de la agencia en el visor
- Perfil público de agencia en `/agency/:slug`

### Seguridad
- Tours protegibles con contraseña
- JWT con access token (15min) + refresh token (30 días)
- Rate limiting en todas las rutas públicas
- Hashing bcrypt de contraseñas

### HelpPage (`/ayuda`)
- Hero animado con GSAP ScrollTrigger y SplitText
- Guía paso a paso con imágenes editoriales
- Tour en vivo embebido con hotspots reales
- Guía completa de Gaussian Splat con viewer SuperSplat embebido
- Sectores: inmobiliarias, constructoras, decoradores, museos
- FAQ interactivo
- CTA final con acceso a cuenta

---

## Para inmobiliarias

### Publicar una propiedad

**Paso 1 — Crear la propiedad**
1. Panel → **Propiedades → Nueva propiedad**
2. Rellena: título, descripción, tipo, precio, superficie, habitaciones, baños
3. Sube imagen de portada
4. Estado inicial: **Borrador** (no visible al público)

**Paso 2 — Añadir el tour virtual**

**Opción A: Imagen 360° (rápida, económica)**
1. Haz la foto 360° con tu móvil — app **Google Street View** (gratuita, iOS y Android): abre → "Crear" → "Foto esférica" → gira sobre ti mismo
2. Panel → **Estancias → Nueva estancia** (una por habitación)
3. **Nuevo asset → tipo Panorama 360°**
4. Sube el JPG/PNG — el visor carga en modo esférico automáticamente

**Opción B: Gaussian Splat (espectacular, diferenciador)**
1. Graba vídeo de 2-3 min por la propiedad (movimientos lentos y continuos)
2. Procesa con **Luma AI** o **Polycam** → archivo `.splat` o `.ply`
3. **Nuevo asset → tipo Gaussian Splat**
4. El comprador se mueve libremente en 3D volumétrico

**Paso 3 — Hotspots**
- **Info:** "Salón de 25 m² con parquet de roble"
- **CTA:** "Contactar agente" → captura el lead desde el visor
- **Navegación:** enlace a otra estancia

**Paso 4 — Publicar y compartir**
1. Estado **Borrador → Publicado**
2. Copia la URL y compártela por WhatsApp, email o portal
3. El cliente explora y deja sus datos desde el tour

### Analytics disponibles

| Métrica | Descripción |
|---|---|
| Engagement score | Índice 0-100 basado en tiempo y acciones |
| Estancias visitadas | Qué habitaciones exploraron |
| Hotspots clickados | Qué información interesó más |
| Leads generados | Contactos directos desde el tour |

### Tour offline para ferias
Ficha de propiedad → **Descargar tour** → `.zip` con `tour.html` que funciona sin internet.

---

## Para constructoras y promotoras

### Promoción sobre plano
1. Crea una propiedad por tipología (Tipo A · 2 hab, Tipo B · 3 hab...)
2. Sube el render 360° de cada tipología
3. Añade hotspots con: precio desde, superficie, calidades, fecha de entrega
4. El comprador visita la unidad antes de que exista físicamente

### Cuando la obra está terminada
1. Graba la unidad piloto con el móvil
2. Procésala con **Luma AI** → archivo `.splat`
3. El comprador ve el acabado real en 3D volumétrico

---

## Para decoradores e interioristas

### Portfolio inmersivo Antes/Después
1. Crea una propiedad por proyecto
2. Dos estancias: **"Antes"** y **"Después"**
3. El cliente alterna entre ambos estados con un clic

### Catálogo interactivo
Hotspot por cada elemento: fabricante, referencia, precio, link a proveedor, nota del diseñador.

---

## Vera — Asistente IA

Vera es la asistente de inteligencia artificial de Immersphere Pro, impulsada por Claude (Anthropic).

### Dos modos de operación

**Modo propiedad** — aparece en cada ficha pública:
- Conoce los datos reales de la propiedad (precio, m², habitaciones, descripción, agencia)
- Ayuda al comprador a entender la propiedad y organizar visitas
- Genera contacto con el agente (llamada, formulario)

**Modo plataforma** — aparece en `/ayuda`:
- Guía a agencias inmobiliarias sobre cómo usar Immersphere
- Explica planes, precios y funciones en detalle
- Estrategia de venta consultiva: diagnostica el problema antes de hacer pitch
- Sistema CTA progresivo: ajusta la propuesta de contacto según el nivel de interés detectado
- Deriva a humano en temas legales, financieros o Enterprise

### Personalidad
Consultiva, directa, sin exceso de entusiasmo. Detecta el perfil del usuario (visitante SaaS, agencia con problema comercial, comprador particular, cliente existente) y adapta el tono y las respuestas.

### Endpoint
`POST /api/chat` — recibe historial de mensajes + propertyId opcional, inyecta contexto de propiedad desde la BD, llama a Claude claude-opus-4-5, devuelve la respuesta. Rate limit: 20 req/min.

---

## Planes y precios

| Plan | Precio | Propiedades | Usuarios | Funciones destacadas |
|---|---|---|---|---|
| **Starter** | 59 €/mes · 1er mes gratis | 5 activas | 1 | Tours 360°, QR, WhatsApp, lead capture, analytics básicos |
| **Pro** | 149 €/mes | 25 activas | 3 | Todo Starter + hero vídeo, storytelling, cinematic tour, analytics engagement, tours con contraseña, Gaussian viewer |
| **Agency** | 349 €/mes | 100 activas | 10 | Todo Pro + white-label, embed iframe, PDF reports, soporte prioritario |
| **Enterprise** | Bajo diagnóstico | Ilimitadas | Ilimitados | Todo Agency + dominios propios, integraciones CRM/API, automatización, reporting a medida |

Gestión de planes con Stripe. Cambio o cancelación en cualquier momento desde **Planes → Gestionar facturación**.

---

## Stack técnico

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Backend | Node.js + Express + Prisma ORM |
| Base de datos | PostgreSQL (Railway) |
| Almacenamiento | Cloudinary (imágenes y assets 3D) |
| Pagos | Stripe (suscripciones + portal de facturación) |
| Auth | JWT (access 15min + refresh 30d) + bcrypt |
| IA | Claude claude-opus-4-5 (Anthropic SDK) — Asistente Vera |
| Email | Resend (notificaciones de lead) |
| Deploy frontend | Vercel (Edge Middleware para OG tags) |
| Deploy backend | Railway |
| Viewer 360° | Custom WebGL + Three.js con inertia + pinch-zoom |
| Viewer Gaussian | @sparkjsdev/spark 2.0 |
| Viewer GLB | model-viewer 3.5 |
| Animaciones | GSAP 3 + ScrollTrigger + SplitText (marketing pages) |
| Mapas | Google Maps iframe + Nominatim geocoding |
| PDF | PDFKit |
| QR | qrcode |

---

## Variables de entorno

Crea `.env` en `/server` con estas variables:

```env
# Base
NODE_ENV=production
PORT=4000
CLIENT_ORIGIN=https://tu-dominio.vercel.app
APP_URL=https://tu-dominio.vercel.app

# Base de datos
DATABASE_URL=postgresql://user:pass@host:5432/immersphere

# Auth
JWT_ACCESS_SECRET=secreto_aleatorio_min_64_chars
JWT_REFRESH_SECRET=secreto_aleatorio_diferente_min_64_chars
JWT_ACCESS_EXPIRES_IN=15m
REFRESH_TOKEN_DAYS=30
BCRYPT_SALT_ROUNDS=12

# Cloudinary
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret
CLOUDINARY_FOLDER=immersphere-pro

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PROFESSIONAL=price_...
STRIPE_PRICE_ENTERPRISE=price_...

# Email (Resend)
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@tudominio.com

# IA — Vera chatbot
ANTHROPIC_API_KEY=sk-ant-api03-...

# Webhooks
LEAD_NOTIFICATION_WEBHOOK_URL=https://...
```

---

## Instalación y desarrollo local

### Requisitos
- Node.js 20+
- pnpm 9+
- PostgreSQL local o cuenta Railway
- Cuenta Cloudinary (tier gratuito suficiente para desarrollo)
- Cuenta Stripe (modo test)
- Cuenta Anthropic (para Vera — opcional en desarrollo)

### Arrancar en local

```bash
# Clonar e instalar dependencias
git clone https://github.com/Juanmaes83/immersphere-pro.git
cd immersphere-pro

# Backend
cd server
pnpm install
cp .env.example .env   # rellenar variables
npx prisma generate
npx prisma db push
pnpm dev               # arranca en :4000

# Frontend (nueva terminal)
cd ../client
pnpm install
pnpm dev               # arranca en :5173
```

Abre `http://localhost:5173` y crea tu primer tenant en `/register`.

### Verificar servicios en producción

```
GET /health
GET /health/services
```

`/health/services` devuelve el estado de Stripe y Cloudinary con sus configuraciones actuales.

---

## Arquitectura de rutas

| Ruta | Descripción |
|---|---|
| `/` | Landing page con hero, features y precios |
| `/gallery` | Galería pública de propiedades |
| `/property/:id/:slug` | Ficha completa de propiedad con visor y Vera |
| `/embed/:id` | Visor limpio embebible (sin navbar ni footer) |
| `/agency/:slug` | Perfil público de agencia con sus propiedades |
| `/ayuda` | Guía completa con tour en vivo y Vera en modo plataforma |
| `/pricing` | Planes y precios + servicios Studio |
| `/dashboard` | Panel de control (auth) |
| `/properties` | Gestión de propiedades (auth) |
| `/leads` | CRM de leads con avatar de agente (auth) |
| `/settings` | Configuración de cuenta, branding y planes (auth) |
| `/property/:id/mobile` | Viewer fullscreen para móvil (sin AppLayout) |

---

## Contacto

**Idea y dirección:** Rubik Sota  
**Teléfono:** 629 554 870  
**Plataforma:** https://immersphere-pro.vercel.app  
**Repositorio:** https://github.com/Juanmaes83/immersphere-pro

---

## Research / Future 3D Pipeline

### Spatial AI & 360 Competitive Intelligence

Auditoria estrategica para convertir investigacion de Spatial AI, captura 360, OCR panoramico, generacion 3D y competencia en decisiones de producto, CRM, SaaS, landing y roadmap.

Fuentes principales:
- Travvir: benchmark de Spatial AI, captura smartphone, SDK propietario, iframe, enterprise y partnership potencial.
- Travvir GitHub: repos publicos a evaluar con cautela; `panoocr` destaca como candidato MIT.
- PanoOCR: posible modulo OCR/metadata para panoramas 360, hotspots sugeridos, accesibilidad y contexto para Vera.
- Matrix-3D: linea I+D Generative 3D Lab para demos conceptuales y showrooms generativos.
- 360 Virtual Tour Creator Softwares: mapa competitivo inicial para Matterport, Kuula, CloudPano, 3DVista, Krpano y otros.

Documentos:
- `docs/research/spatial-ai-master-audit.md`
- `docs/research/travvir-spatial-ai-benchmark.md`
- `docs/research/travvir-github-repos-analysis.md`
- `docs/research/panoocr-360-ocr-analysis.md`
- `docs/research/matrix-3d-generative-worlds-analysis.md`
- `docs/research/360-virtual-tour-competitor-map.md`
- `docs/research/immersphere-spatial-ai-roadmap.md`
- `docs/research/immersphere-copy-adapt-build-matrix.md`

### LichtFeld Studio - Gaussian Splatting

LichtFeld Studio queda registrado como tecnología candidata para el futuro pipeline 3D de Immersphere Pro SaaS.

Enlaces:
- Web oficial: https://lichtfeld.io/
- Showcase: https://lichtfeld.io/showcase/
- Repositorio GitHub: https://github.com/MrNeRF/LichtFeld-Studio

Uso previsto:
- pruebas internas de Gaussian Splatting;
- experiencias 3D para inmuebles, showrooms, arquitectura y espacios premium;
- posible exportación a visor web / HTML;
- conexión futura con landings comerciales, CTA y CRM Leads.

Estado actual:
- Research / I+D candidate.
- No integrado en producción.
- No copiar código ni usar como dependencia hasta revisar licencia, rendimiento móvil, hosting, costes GPU y viabilidad comercial.

Documento técnico:
`docs/research/lichtfeld-studio-gaussian-splatting.md`

Decisión:
Mantener como módulo Immersphere Pro Lab / 3D Capture Pipeline para prueba futura controlada.
