# CaptureJob Fase 2 - Implementation Notes

## Implementado

Fase 2 introduce una primera capa real y prudente de CaptureJob dentro del SaaS Immersphere Pro:

- Entidad `CaptureJob` en Prisma.
- Entidades `CaptureInputAsset` y `CaptureOutputAsset`.
- API privada con auth JWT y validacion por `tenantId`.
- Asociacion opcional con `Property`.
- Asociacion opcional con `Lead`, validada a traves de `Lead -> Property -> tenantId`.
- Upload controlado para material de entrada.
- `publicUrl` y `qrUrl`.
- Generacion de QR server-side usando la dependencia `qrcode` ya existente.
- Vista publica segura para jobs publicados.
- UI protegida `/capture-jobs` para listar, crear, editar, archivar y revisar jobs.

## Modelos

### CaptureJob

Campos principales:

- `tenantId`, `userId`
- `leadId`, `propertyId`
- `title`, `clientName`
- `projectType`, `vertical`
- `status`, `priority`, `source`
- `assignedTo`, `dueDate`
- `estimatedCost`, `estimatedHours`, `commercialValue`
- `riskLevel`, `nextAction`, `notes`
- `publicUrl`, `qrUrl`

Los estados se guardan como strings, igual que el resto del schema actual.

### CaptureInputAsset

Registra material recibido:

- `type`, `filename`, `url`, `publicId`
- `source`, `format`, `size`
- `status`, `rightsStatus`, `qualityScore`, `notes`

### CaptureOutputAsset

Registra entregables:

- `type`, `format`, `url`, `publicId`
- `status`
- `viewerReady`, `mobileReady`
- `publishedUrl`, `qrUrl`
- `analyticsEnabled`, `notes`

## Rutas API

Privadas, con `requireAuth`:

- `GET /api/capture-jobs`
- `POST /api/capture-jobs`
- `GET /api/capture-jobs/:captureJobId`
- `PUT /api/capture-jobs/:captureJobId`
- `DELETE /api/capture-jobs/:captureJobId`
- `POST /api/capture-jobs/:captureJobId/qr`
- `POST /api/capture-jobs/:captureJobId/upload`
- `POST /api/capture-jobs/:captureJobId/input-assets`
- `PUT /api/capture-jobs/:captureJobId/input-assets/:assetId`
- `DELETE /api/capture-jobs/:captureJobId/input-assets/:assetId`
- `POST /api/capture-jobs/:captureJobId/output-assets`
- `PUT /api/capture-jobs/:captureJobId/output-assets/:assetId`
- `DELETE /api/capture-jobs/:captureJobId/output-assets/:assetId`

Publica:

- `GET /api/capture-jobs/public/:captureJobId`

La ruta publica solo devuelve jobs con estado `published` o `connected_to_crm`, y no expone notas internas, costes, lead, tenant ni usuario.

## Upload controlado

La ruta `POST /api/capture-jobs/:captureJobId/upload` reutiliza `storeUploadFile` y cuota de storage existente, pero aplica una politica mas estricta que `/api/uploads`.

Permitido inicialmente:

- imagenes: `jpg`, `jpeg`, `png`, `webp`
- video: `mp4`, `mov`
- documentos: `pdf`

No permitido todavia:

- `html`
- `zip`
- `ply`
- `spz`
- `sog`
- otros binarios o ejecutables

Motivo: estos formatos requieren una politica especifica de publicacion, descarga, aislamiento o procesamiento futuro. Esta fase no implementa procesamiento pesado ni laboratorio automatico.

## Frontend

Rutas:

- `/capture-jobs`: dashboard protegido de Capture Jobs.
- `/capture/:id`: vista publica sencilla.

Capacidades:

- Listar jobs.
- Filtrar por estado, prioridad, riesgo y busqueda.
- Crear y editar datos principales.
- Asociar `propertyId`.
- Guardar `leadId` manual si se conoce.
- Subir input assets permitidos.
- Registrar output assets.
- Guardar `publicUrl`.
- Generar `qrUrl` si ya existe `publicUrl`.
- Archivar job sin borrado fisico.

## No implementado en esta fase

- Workers.
- Colas.
- OCR.
- IA externa.
- GPU.
- Matrix-3D.
- 360Gaussian embebido.
- Gaussian Splatting como flujo de procesamiento.
- Capture App movil.
- Envio automatico de emails o WhatsApp.
- Sincronizacion automatica con el CRM standalone.
- Publicacion de notas internas, costes o leads.

## Riesgos pendientes

- Ejecutar la migracion real requiere entorno de base de datos configurado.
- El repositorio no tenia `node_modules` instalados durante la implementacion, por lo que los comandos de build/typecheck requieren instalar dependencias fijadas.
- La entidad `Lead` no tiene `tenantId` directo; la validacion se hace por `Lead -> Property`.
- `publicUrl` puede apuntar a un destino externo; hoy se guarda como campo manual. No se valida SSRF porque no se hace fetch server-side de esa URL.
- La vista publica es deliberadamente minima y no sustituye al viewer principal.

## Como probar manualmente

1. Instalar dependencias en `server` y `client` si no existen.
2. En `server`, ejecutar Prisma con la version fijada del repo:
   - `npm install`
   - `npm run prisma:generate`
   - aplicar migracion local o `npm run prisma:push` en entorno de desarrollo.
3. Arrancar API:
   - `npm run dev`
4. Arrancar frontend:
   - `npm run dev`
5. Entrar con usuario autenticado.
6. Abrir `/capture-jobs`.
7. Crear un CaptureJob con titulo, cliente y estado inicial.
8. Asociar una propiedad si existe.
9. Subir un jpg/png/webp/mp4/mov/pdf.
10. Registrar un output asset.
11. Guardar `publicUrl`.
12. Generar QR.
13. Cambiar estado a `published`.
14. Abrir `/capture/:id` y verificar que no aparecen notas internas, costes ni datos privados.
