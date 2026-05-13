# Immersphere Pro

Plataforma SaaS multi-tenant para crear y publicar tours virtuales inmersivos de propiedades, espacios y proyectos de interiorismo. Compatible con imágenes 360°, Gaussian Splat y modelos 3D.

**URL de producción:** https://immersphere-pro.vercel.app  
**Idea y dirección:** Rubik Sota · 629 554 870

---

## Índice

1. [¿Qué es Immersphere Pro?](#qué-es-immersphere-pro)
2. [Para inmobiliarias](#para-inmobiliarias)
3. [Para constructoras y promotoras](#para-constructoras-y-promotoras)
4. [Para decoradores e interioristas](#para-decoradores-e-interioristas)
5. [¿Qué ve el cliente final?](#qué-ve-el-cliente-final)
6. [Planes disponibles](#planes-disponibles)
7. [Stack técnico](#stack-técnico)
8. [Instalación y desarrollo local](#instalación-y-desarrollo-local)

---

## ¿Qué es Immersphere Pro?

Immersphere Pro permite a empresas del sector inmobiliario, constructoras, promotoras y estudios de interiorismo publicar tours virtuales 3D de sus espacios. El cliente final solo necesita un navegador — sin apps, sin plugins, sin registros.

**Lo que diferencia la plataforma:**

- **Tours en 3 formatos:** imagen 360°, Gaussian Splat volumétrico y mesh 3D (.glb)
- **Lead capture integrado:** cada tour puede capturar email y teléfono del visitante
- **Analytics de comportamiento:** sabes qué habitaciones interesan más y cuánto tiempo pasa cada visitante
- **Hotspots contextuales:** puntos informativos dentro del visor (precio, m², materiales, CTA de contacto)
- **Descarga offline:** el tour se exporta como ZIP para enviarlo por email o usar en ferias sin internet
- **Multi-tenant:** cada empresa tiene su espacio aislado, sus propiedades y su branding

---

## Para inmobiliarias

### Cómo publicar una propiedad

**Paso 1 — Crear la propiedad**

1. Entra en el panel y ve a **Propiedades → Nueva propiedad**
2. Rellena: título, descripción, tipo, precio, superficie, habitaciones, baños
3. Sube una imagen de portada (miniatura que aparece en la galería)
4. Guarda → el estado inicial es **Borrador** (no visible al público)

**Paso 2 — Añadir el tour virtual**

Tienes dos opciones según tu presupuesto y el impacto que quieras conseguir:

#### Opción A: Imagen 360° (rápida, económica)

1. Haz la foto 360° con tu móvil o con un fotógrafo especializado
   - Apps gratuitas: **Google Street View**, **Cardboard Camera**
   - Cámaras recomendadas: Ricoh Theta, Insta360, GoPro Max
2. En el panel: **Estancias → Nueva estancia** (una por habitación)
3. Dentro de la estancia: **Nuevo asset → tipo Panorama 360°**
4. Sube el archivo JPG/PNG — Cloudinary lo almacena y devuelve la URL
5. El visor carga la imagen en modo esférico automáticamente

#### Opción B: Gaussian Splat (espectacular, diferenciador)

1. Graba un vídeo de 2-3 minutos caminando por la propiedad con movimientos lentos y continuos
2. Procesa el vídeo con **Luma AI** (luma.ai) o **Polycam** para obtener un archivo `.splat` o `.ply`
3. En el panel: **Nuevo asset → tipo Gaussian Splat**
4. Sube el archivo — el visor lo renderiza en tiempo real con tecnología volumétrica
5. El comprador puede moverse libremente por el espacio en 3D

**Paso 3 — Añadir hotspots**

Dentro de cada asset puedes añadir puntos de información:
- **Info:** "Salón de 25 m² con parquet de roble"
- **Medición:** "Altura libre: 2,80 m"
- **CTA:** "Contactar agente" → captura el lead directamente desde el visor
- **Navegación:** enlace a otra estancia o espacio

**Paso 4 — Publicar y compartir**

1. Cambia el estado de **Borrador** a **Publicado**
2. La propiedad aparece en la galería pública
3. Copia la URL `/property/:id` y compártela por WhatsApp, email o portal inmobiliario
4. El cliente entra, explora y puede dejar sus datos de contacto

### Qué obtienes

| Métrica | Lo que significa |
|---|---|
| Aperturas del visor | Cuántas veces alguien abrió el tour |
| Estancias visitadas | Qué habitaciones exploraron |
| Engagement score | Índice de interés 0-100 basado en tiempo y acciones |
| Leads generados | Contactos directos desde el tour |

Exporta todos los leads a CSV con un clic e impórtalos en tu CRM.

### Tour offline para ferias y eventos

En la ficha de cada propiedad: **Descargar tour**. Obtienes un `.zip` con un `tour.html` que funciona sin internet. Ábrelo en el portátil de tu stand.

---

## Para constructoras y promotoras

### Mostrar una promoción sobre plano

1. Crea una propiedad por cada tipología (Tipo A · 2 hab, Tipo B · 3 hab, etc.)
2. Sube el render 360° de cada tipología como panorama
3. Añade hotspots con:
   - Precio desde
   - Superficie en m²
   - Calidades incluidas
   - Fecha estimada de entrega
4. Comparte el link con tus compradores potenciales

Los compradores visitan la unidad antes de que exista físicamente. El promotor sabe qué tipología genera más interés antes de decidir qué construir.

### Cuando la obra está terminada

1. Graba un vídeo de la unidad piloto con el móvil
2. Procésalo con **Luma AI** o **Polycam** → archivo `.splat`
3. Sube el Gaussian Splat a la plataforma
4. El comprador ve el acabado real en 3D volumétrico — sin fotografías planas

---

## Para decoradores e interioristas

### Portfolio inmersivo

1. Crea una propiedad por proyecto (nombre del cliente o del espacio)
2. Crea dos estancias: **"Antes"** y **"Después"**
3. Sube la imagen 360° del espacio vacío en la estancia "Antes"
4. Sube la imagen 360° del espacio decorado en la estancia "Después"
5. El cliente alterna entre ambos estados con un clic

### Catálogo interactivo con hotspots

Dentro del espacio decorado, añade un hotspot por cada elemento destacado:
- Fabricante y referencia del mueble
- Precio orientativo
- Link a la tienda o proveedor
- Nota del diseñador

### Capturar nuevos clientes

1. Comparte el link público de tu portfolio
2. El cliente explora tus proyectos en modo inmersivo
3. Si le interesa, hace clic en **"Contactar"** → te llega su email y teléfono
4. Exportas todos los leads a CSV y los gestionas en tu herramienta habitual

---

## ¿Qué ve el cliente final?

**Absolutamente nada que instalar.** El cliente recibe un link, hace clic y el tour carga en su navegador — móvil, tablet o PC.

- En móvil: arrastra para girar la cámara
- En PC: clic y arrastrar, scroll para zoom
- En Gaussian Splat: movimiento libre en 3D
- Los hotspots aparecen como puntos sobre el espacio — clic para ver la información

---

## Planes disponibles

| Plan | Propiedades | Almacenamiento | Hotspots | Analytics | White Label |
|---|---|---|---|---|---|
| **Starter** | 10 | 500 MB | Básicos | Básico | No |
| **Professional** | 50 | 5 GB | Avanzados | Completo | Parcial |
| **Enterprise** | Ilimitadas | Ilimitado | Todos | Completo + API | Completo |

Los planes se gestionan con Stripe. Puedes cambiar de plan o cancelar en cualquier momento desde **Planes → Gestionar facturación**.

---

## Stack técnico

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Backend | Node.js + Express + Prisma ORM |
| Base de datos | PostgreSQL (Railway) |
| Almacenamiento | Cloudinary (imágenes y assets 3D) |
| Pagos | Stripe (suscripciones + portal de facturación) |
| Auth | JWT + bcrypt |
| Deploy frontend | Vercel |
| Deploy backend | Railway |
| Viewer 360° | Custom WebGL + Three.js |
| Viewer Splat | @sparkjsdev/spark 2.0 |

---

## Instalación y desarrollo local

### Requisitos

- Node.js 20+
- PostgreSQL local o cuenta Railway
- Cuenta Cloudinary (tier gratuito suficiente para desarrollo)
- Cuenta Stripe (modo test)

### Variables de entorno

Copia `.env.example` a `.env` en la carpeta `/server` y rellena:

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/immersphere
JWT_SECRET=tu_secreto_aleatorio_minimo_32_chars
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PROFESSIONAL=price_...
STRIPE_PRICE_ENTERPRISE=price_...
CLIENT_URL=http://localhost:5173
```

### Arrancar en local

```bash
# Instalar dependencias
cd server && npm install
cd ../client && npm install

# Generar cliente Prisma y aplicar migraciones
cd ../server
npx prisma generate
npx prisma migrate dev

# Arrancar backend (puerto 3000)
npm run dev

# Arrancar frontend (puerto 5173) — en otra terminal
cd ../client
npm run dev
```

Abre `http://localhost:5173` y crea tu primer tenant en `/register`.

### Verificar servicios en producción

```
GET /health/services
```

Devuelve el estado de Stripe y Cloudinary con sus configuraciones actuales.

---

## Contacto

**Idea y dirección:** Rubik Sota  
**Teléfono:** 629 554 870  
**Plataforma:** https://immersphere-pro.vercel.app
