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

## Gaussian / 3D manual output premium

Paso 10 añade soporte real, manual y seguro para publicar experiencias 3D premium como outputs de `CaptureJob`.

Tipos soportados en `CaptureOutputAsset.type`:

- `gaussian_splat`
- `splat_viewer`
- `supersplat`
- `spark_viewer`
- `external_3d_viewer`

No se crea tabla nueva ni migracion nueva porque `CaptureOutputAsset.type` ya es `String`.

### Como registrar una URL Supersplat / Spark / viewer externo

1. Abrir `/capture-jobs`.
2. Seleccionar o crear un CaptureJob.
3. En `Output assets`, elegir uno de los tipos premium 3D.
4. Pegar la URL pública del viewer externo en `url` o `publishedUrl`.
5. Elegir `format` sugerido:
   - `splat`
   - `gaussian`
   - `external_url`
   - `iframe`
6. Marcar `Desktop OK` si el viewer funciona en desktop.
7. Marcar `Mobile OK` si el viewer funciona en movil.
8. Cambiar `status` a `published` cuando este listo para cliente.

En `/capture/:id`, los outputs publicados de tipo 3D premium tienen prioridad sobre outputs normales y se muestran como experiencia principal con el titulo "Experiencia 3D inmersiva".

### Validacion de URL

Backend valida los outputs premium 3D al crear o editar:

- URL obligatoria.
- Solo `http` o `https`.
- Bloquea `javascript:`, `data:`, `file:`, `blob:` y protocolos no web.
- Bloquea `localhost`, hosts `.local` y rangos IPv4 privados o loopback.
- No hace `fetch` externo obligatorio.
- No aplica whitelist estricta para no bloquear viewers propios.

El iframe solo se intenta si la URL pertenece a un host conocido como embebible:

- `superspl.at`
- `sparkjs.dev`
- `playcanvas.com`
- `luma.ai`
- `lumalabs.ai`
- dominios propios de Immersphere ya previstos

Si no es embebible o es dudosa, `/capture/:id` muestra boton externo.

### Desktop OK / Mobile OK

Se reutilizan campos existentes:

- `viewerReady` = Desktop OK.
- `mobileReady` = Mobile OK.

No hay nueva migracion para QA. Es deliberadamente simple y auditable.

## Pipeline manual Gaussian/Splat

Paso 11 convierte el soporte 3D premium manual en un flujo operativo repetible para produccion real sin anadir migraciones ni abrir uploads 3D inseguros.

### Objetivo

Registrar, validar, publicar y controlar outputs Gaussian/Splat generados externamente dentro de `CaptureJob`, manteniendo la vista publica limpia y sin exponer datos internos.

### Provider 3D

No se anade campo `provider` en Prisma. El provider se deriva de `type` y de la URL:

- `supersplat` o `superspl.at` => SuperSplat.
- `spark_viewer` o URL con referencia a Spark => Spark.
- URL con `luma.ai` o `lumalabs.ai` => Luma.
- `external_3d_viewer` => viewer propio o externo.
- otros casos => otro provider.

La UI interna de `/capture-jobs` muestra el provider derivado al registrar y revisar outputs 3D.

### Output 3D principal

No existe `isPrimary` persistente en esta fase. El output 3D principal se decide automaticamente y sin efectos destructivos:

1. Solo se consideran outputs premium 3D.
2. Se priorizan outputs con `status = published`.
3. Orden de prioridad por `type`:
   - `gaussian_splat`
   - `splat_viewer`
   - `supersplat`
   - `spark_viewer`
   - `external_3d_viewer`
4. Si hay varios con la misma prioridad, gana el mas reciente.

La UI interna muestra el aviso "Principal automatico" para que el equipo sepa que output actuara como experiencia 3D principal. La vista publica `/capture/:id` recibe los outputs publicados ya ordenados con esa prioridad.

### Desktop OK

`viewerReady` sigue siendo el check operativo de Desktop OK. Debe marcarse solo cuando el viewer cargue, sea navegable y tenga un fallback externo usable.

### Mobile OK

`mobileReady` sigue siendo el check operativo de Mobile OK. Debe marcarse solo tras prueba real en movil o emulacion aceptada por el equipo. Si un output esta `published` sin `mobileReady`, `/capture-jobs` muestra aviso interno.

### Iframe y fallback

`publishedUrl || url` actúa como URL pública y fallback externo. El sistema intenta iframe solo para hosts conocidos como embebibles. Si el host no es embebible, el flujo correcto es abrir la experiencia en una pestaña externa.

Checklist interno:

- URL valida.
- Provider definido.
- Desktop probado.
- Movil probado.
- Iframe viable o fallback externo confirmado.
- `status = published`.

### Rendimiento aceptable

No se anade campo `performanceReady`. El rendimiento aceptable se revisa manualmente y se documenta en `CaptureOutputAsset.notes`, que funciona como observacion QA interna. Estas notas no se serializan en la API publica.

Criterio practico:

- Carga inicial razonable para el tipo de escena.
- Interaccion estable en desktop.
- Mobile no queda en pantalla rota.
- Si iframe falla o el rendimiento embebido es pobre, fallback externo confirmado.

### Seguridad publica

`/capture/:id` no expone:

- `tenantId`
- `userId`
- `leadId`
- `notes`
- `estimatedCost`
- `estimatedHours`
- `commercialValue`
- `inputAssets`
- observaciones QA internas de outputs

### Que NO se implementa

- Generacion automatica Gaussian/Splat.
- Uploads `.ply`, `.spz`, `.splat`, `.sog`, `html` o `zip`.
- Procesamiento GPU.
- Workers.
- Colas.
- 360Gaussian automatico.
- OCR o IA externa.
- Analitica nueva.
- Dashboard grande.

### Riesgos

- Al no existir `isPrimary`, la seleccion principal es automatica y no editable manualmente.
- `iframeOk`, `fallbackOk` y `performanceOk` no son flags persistentes; se derivan o se registran en notas internas.
- Viewers externos pueden cambiar cabeceras, permisos o disponibilidad sin control de Immersphere.

### Siguiente paso recomendado

Si el pipeline manual se usa en produccion con varios providers reales, evaluar una migracion minima para `provider`, `isPrimary`, `fallbackUrl`, `iframeReady`, `fallbackReady`, `performanceReady` y `qaNotes`.

## Captura guiada basica

Paso 12 anade una capa interna de captura guiada dentro de `/capture-jobs` para mejorar la calidad del material antes de producir tours, videos, fotografias, documentos o experiencias 3D.

### Objetivo

Ayudar al equipo a detectar material insuficiente, recorridos incompletos, videos mal planteados o inputs no aptos para 3D/Gaussian antes de publicar entregables. Es una ayuda operativa privada, no una validacion automatica ni un bloqueo.

### Checklists incluidos

La UI privada muestra un bloque "Captura guiada" con checklist segun tipo de entrega:

- 3D / Gaussian / Splat.
- Tour 360.
- Video comercial.
- Fotos inmobiliarias / showroom.
- Plano / documento.
- General.

El tipo se infiere desde `projectType`, `vertical`, `nextAction`, `inputAssets` y `outputAssets`. El equipo puede cambiarlo en un selector local de UI; ese cambio no se persiste en base de datos.

### Estado de material

No se anade `materialStatus` en Prisma. El estado se deriva de campos existentes:

- Sin `inputAssets`: `Material incompleto`.
- Con `inputAssets` pero sin output listo/publicado: `Material pendiente de revisar`.
- Con `inputAssets` y algun output `ready`, `approved` o `published`: `Material suficiente`.

El estado es orientativo. No pretende certificar calidad real del material.

### Avisos operativos

La UI muestra avisos no bloqueantes:

- No hay material de entrada registrado.
- Hay material, pero aun no hay output generado.
- El CaptureJob tiene output publicado, revisa QA antes de compartir.
- Para 3D/Gaussian, valida movil antes de marcar entrega como lista.
- Para tour 360, revisa navegacion y puntos de transicion.
- Para video, define formato vertical/horizontal antes de producir.

### Relacion con inputs y outputs 3D

El bloque muestra:

- numero de `inputAssets`;
- resumen por tipo/formato de inputs;
- si existe output 3D premium;
- provider derivado;
- Desktop OK / pendiente;
- Mobile OK / pendiente;
- fallback externo OK / pendiente.

No modifica restricciones de upload ni permite nuevos formatos.

### Que NO hace

- No captura automaticamente.
- No genera 3D.
- No analiza imagenes.
- No usa IA.
- No bloquea publicacion.
- No crea workers ni colas.
- No expone esta informacion en `/capture/:id`.

### Siguiente paso recomendado

Si el equipo empieza a usar la guia como control formal de calidad, evaluar una migracion minima para guardar checklist, responsable, fecha de revision y estado real de material.

## Procesamiento IA de CaptureJob

Paso 13 anade procesamiento IA real, privado y persistente para `CaptureJob`. El equipo puede lanzar un analisis desde `/capture-jobs` con el boton "Procesar con IA". El backend construye un resumen seguro del job, llama a Anthropic desde servidor, valida JSON estructurado y guarda el resultado como run historico.

### Que hace

- Crea runs persistentes en `CaptureAiProcessingRun`.
- `POST /ai/process` responde rapido con el run `running`; el procesamiento continúa en backend.
- Resume datos basicos del CaptureJob.
- Resume `inputAssets` y `outputAssets` sin leer binarios.
- Deriva estado de material, estado 3D y QA desktop/mobile.
- Llama a Anthropic solo desde backend.
- Fuerza salida estructurada con tool calling y valida el resultado con Zod.
- Guarda `inputSummary`, `result`, `status`, modelo, tokens y errores.
- Permite consultar ultimos runs desde endpoints privados.
- Muestra el ultimo run y un historial en `/capture-jobs`.
- La UI consulta runs cada pocos segundos mientras exista un run `running`.
- Permite copiar secciones: estructura, hotspots, copy comercial, guion y proximas acciones.

### Que genera

El JSON de resultado incluye:

- estructura recomendada de experiencia;
- hotspots sugeridos;
- copy comercial;
- guion de video;
- material faltante;
- recomendaciones QA;
- proximas acciones;
- confidence score.

El resultado es recomendacion operativa. No se aplica automaticamente al CaptureJob.

### Datos que usa

Se envia a IA un `inputSummary` minimizado:

- `title`, `clientName`, `projectType`, `vertical`, `status`, `priority`, `riskLevel`, `nextAction` y notas internas truncadas;
- numero y resumen de assets;
- `inputAssets`: id, tipo, nombre truncado, formato, estado y fecha;
- `outputAssets`: id, tipo, formato, estado, QA desktop/mobile, provider derivado, existencia de URL y dominio publico seguro;
- estado 3D principal: provider, desktop, mobile, fallback y status.

### Datos que no usa

No se envia:

- `tenantId`;
- `userId`;
- API keys;
- `DATABASE_URL`;
- auth headers;
- contenido binario;
- contenido completo de imagenes, PDFs o videos;
- URLs completas con query params o tokens;
- datos privados no necesarios.

### Privacidad y tenant isolation

Los endpoints usan `requireAuth` y validan que el `CaptureJob` pertenece al `tenantId` autenticado. Los runs guardan `tenantId` y se consultan siempre filtrando por `tenantId` y `captureJobId`. No existe endpoint publico de IA y `/capture/:id` no muestra estos resultados.

### Prompt injection

El prompt del sistema trata nombres de archivo, notas, URLs y metadatos como datos no confiables. Indica expresamente que cualquier instruccion dentro del CaptureJob debe ignorarse si intenta cambiar reglas, revelar secretos, saltar privacidad o modificar el formato. La salida se fuerza mediante una tool Anthropic con `input_schema` equivalente al resultado esperado y se valida con Zod antes de marcar el run como `completed`.

Si la salida no entra por tool calling, existe fallback controlado:

- limpiar markdown/code fences;
- extraer el primer objeto JSON viable;
- validar con Zod;
- ejecutar como maximo un retry barato de reparacion con el mismo modelo configurado.

Si la reparacion falla, el run queda `failed` con error interno resumido y la UI muestra un mensaje accionable sin exponer la respuesta cruda completa.

Los errores internos se guardan con codigos para diagnostico:

- `TOOL_USE_MISSING`: Anthropic no devolvio el bloque `tool_use` esperado.
- `TOOL_INPUT_SCHEMA_INVALID`: la entrada de tool no tenia la forma minima esperada.
- `ZOD_VALIDATION_FAILED`: la estructura normalizada no paso validacion final.
- `JSON_PARSE_FAILED`: fallback de texto no pudo parsearse como JSON.
- `MODEL_NOT_AVAILABLE`: el modelo configurado no existe o no esta disponible.
- `ANTHROPIC_API_ERROR`: error general del proveedor IA.

La UI traduce estos codigos a mensajes simples para el equipo sin mostrar respuestas crudas completas.

### Estrategia de seleccion de modelo

El procesamiento IA usa una politica de bajo coste por defecto. No se hardcodea Opus ni un modelo caro como default.

Prioridad:

1. Si `ANTHROPIC_MODEL` tiene valor, se usa como override explicito.
2. Si `ANTHROPIC_MODEL` esta vacio, se usa `CAPTURE_AI_MODEL_TIER`.
3. Si `CAPTURE_AI_MODEL_TIER` no existe, el default es `cheap`.

Tiers controlados en backend:

- `cheap`: default, pensado para bajo coste y baja latencia. Actualmente apunta a `claude-haiku-4-5-20251001`.
- `balanced`: opcion media tipo Sonnet, solo si se configura explicitamente. Actualmente apunta a `claude-sonnet-4-5-20250929`.
- `premium`: reservado para futuro y nunca debe ser default. Actualmente no usa Opus por defecto.

Si Anthropic cambia nombres, precios o disponibilidad de modelos, solo hay que actualizar el mapa de modelos del backend. `ANTHROPIC_MODEL` permite override manual sin tocar codigo.

### Variables necesarias

- `ANTHROPIC_API_KEY`: obligatoria para ejecutar el procesamiento.
- `ANTHROPIC_MODEL`: opcional. Override manual con maxima prioridad.
- `CAPTURE_AI_MODEL_TIER`: opcional. Default: `cheap`.
- `AI_PROCESSING_MAX_ASSETS`: opcional. Default: `10`.
- `AI_PROCESSING_MAX_RUNS`: opcional. Default: `10`.

Si falta `ANTHROPIC_API_KEY`, el backend no rompe el arranque. Al pulsar "Procesar con IA", se crea un run `failed` y se devuelve error controlado: `ANTHROPIC_API_KEY no configurada`.

### Control de coste

- No hay prompt libre del usuario.
- Se limita el numero de assets enviados.
- Se truncan notas y nombres largos.
- Se usa `max_tokens` razonable: `2500`.
- Se bloquea un nuevo run si ya hay uno `running` para el mismo CaptureJob.
- El boton queda deshabilitado mientras exista un run `running`.
- Si el cliente sufre timeout, la UI refresca runs y muestra que el procesamiento sigue en curso.
- Se guarda uso de tokens cuando Anthropic lo devuelve.

### Como probar

Backend:

1. Configurar `ANTHROPIC_API_KEY` en entorno local si se quiere una llamada real.
2. Ejecutar `npx prisma generate`.
3. Validar schema con `npx prisma validate`.
4. Ejecutar `npx tsc --noEmit`.
5. Arrancar API.

Frontend:

1. Ejecutar `npx tsc --noEmit`.
2. Ejecutar `npm run build`.
3. Entrar autenticado.
4. Abrir `/capture-jobs`.
5. Seleccionar un CaptureJob.
6. Pulsar "Procesar con IA".
7. Revisar ultimo run, secciones generadas e historial.

### Que NO hace

- No genera Gaussian/Splat.
- No procesa video.
- No lee imagenes.
- No hace OCR.
- No descarga archivos.
- No publica automaticamente.
- No modifica automaticamente el CaptureJob.
- No crea workers ni colas.
- No expone resultados en `/capture/`.

### Siguiente paso recomendado

Cuando haya uso real, valorar controles de producto por plan, metricas de coste por tenant, reintentos administrados y un estado formal de aprobacion humana antes de convertir recomendaciones IA en cambios editables del CaptureJob.

## Briefing comercial para procesamiento IA

Paso 13B anade un briefing comercial interno y persistente dentro de `CaptureJob` para mejorar la calidad del procesamiento IA. El objetivo es dar contexto real al modelo sin subir a modelos caros por defecto.

### Campos que recoge

Se guarda en `CaptureJob.commercialBrief` como JSON privado:

- tipo de inmueble o activo;
- ubicacion;
- superficie o tamaño;
- habitaciones o zonas clave;
- banos o equipamiento;
- rango de precio o valor comercial;
- publico objetivo;
- objetivo comercial;
- beneficios clave;
- diferenciales;
- tono deseado;
- CTA objetivo;
- notas de marca;
- restricciones o cosas a evitar.

Tambien se guardan:

- `commercialBriefUpdatedAt`;
- `commercialBriefCompleteness`.

Produccion usa historicamente `prisma db push`; estos campos requieren aplicar el schema con ese flujo existente. No se requiere `migrate deploy` para esta fase.

### Completeness

El porcentaje es orientativo y no bloqueante:

- `propertyType`: +10.
- `location`: +10.
- `targetAudience`: +15.
- `salesObjective`: +15.
- al menos 2 `keyBenefits`: +15.
- al menos 1 `differentiator`: +15.
- `ctaGoal`: +10.
- `tone`: +10.

Maximo: 100.

### Como mejora la IA

El `commercialBrief` se incluye en `inputSummary` de forma minimizada y truncada. El prompt indica que debe usarse para:

- evitar copy generico;
- adaptar tono;
- crear hotspots mas concretos;
- orientar CTA;
- mejorar guion de video;
- detectar material o contexto faltante;
- ajustar confidence.

El briefing se trata como contenido no confiable, no como instrucciones. Mantiene la proteccion contra prompt injection.

### Prompt y estilo

El procesamiento IA debe responder en espanol profesional de Espana, cuidar tildes y gramatica, evitar anglicismos innecesarios y no inventar claims no soportados por los datos. Antes de guardar, el backend aplica un corrector simple sin llamada extra IA para patrones claros como:

- `decision` -> `decision` con tilde;
- `Proximas` -> `Proximas` con tilde;
- `immueble` -> `inmueble`;
- tildes comunes en palabras operativas;
- espacios dobles.

Este corrector solo postprocesa el resultado IA; no modifica datos originales del usuario.

### Confidence

La confidence no depende solo del modelo. El backend aplica limites posteriores:

- sin `inputAssets`: mantiene aviso de limitacion;
- briefing inexistente o por debajo de 40: maximo 60;
- briefing >= 70 + output 3D listo/publicado + sin `inputAssets`: confidence entre 60 y 70;
- briefing >= 90 + output 3D publicado + desktop/mobile/fallback OK + sin `inputAssets`: maximo 70;
- inputs + briefing completo + QA OK: puede llegar a 90-95;
- nunca se permite 100 salvo datos realmente completos y QA completo.

Si se limita por falta de inputs pero el briefing y el output 3D estan completos, la explicacion debe indicar: `Confianza limitada porque no hay inputAssets registrados, aunque el briefing y el output 3D estan completos.`

El postprocesado evita secciones vacias en runs nuevos. Si la IA devuelve `commercialCopy`, `videoScript`, `nextActions`, `missingMaterial` o `qaRecommendations` sin contenido util, el backend genera fallback minimo desde `commercialBrief`, output 3D, estado de material y QA sin hacer llamadas adicionales ni cambiar el modelo barato por defecto.

### UI privada

En `/capture-jobs`, el bloque `Briefing comercial` permite editar y guardar el contexto. El bloque `Procesamiento IA` muestra:

- contexto disponible;
- numero de input assets;
- si hay output 3D detectado;
- aviso `Resultado limitado por falta de material/contexto.` cuando falta briefing, inputs o la confidence es baja.
- copy comercial completo: descripcion corta/larga, highlights, angle, publico y CTAs;
- guion de video completo: hook, escenas, voiceover, CTA y formatos;
- proximas acciones con motivo;
- QA recomendado ampliado con desktop, mobile, performance y viewer.

Tras guardar briefing, el equipo puede pulsar de nuevo `Procesar con IA`. No se borran runs anteriores.

### Que NO hace

- No publica automaticamente.
- No modifica outputs.
- No cambia a Sonnet ni Opus por defecto.
- No aumenta el numero de llamadas salvo el flujo ya existente de reparacion.
- No expone briefing ni resultados IA en `/capture/:id`.

### Como probar

1. Abrir `/capture-jobs` con usuario autenticado.
2. Seleccionar un CaptureJob.
3. Completar `Briefing comercial`.
4. Guardar briefing.
5. Pulsar `Procesar con IA`.
6. Confirmar que el nuevo run usa el briefing actualizado, mejora el copy/hotspots y ajusta la confidence segun contexto.

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
- Generacion automatica de Gaussian/Splat.
- Upload de `.ply`, `.spz`, `.splat`, `.sog`, `html` o `zip` dentro de CaptureJob.

## Aplicación de sugerencias IA y hotspots públicos

La IA pasa de ser consultiva a operativa, pero siempre con humano en control. Un run IA `completed` puede aplicarse desde la UI privada de `/capture-jobs` con botones explícitos:

- `Aplicar copy al CaptureJob`: guarda `appliedAiContent` en el CaptureJob y registra `sourceRunId`.
- `Crear checklist de producción`: reutiliza `nextActions` dentro de `appliedAiContent`.
- `Crear hotspots borrador`: crea `CaptureHotspot` en `draft` e `isPublic=false`.

Nada se publica automáticamente. Los hotspots se gestionan manualmente con estados:

- `draft`: borrador privado.
- `approved`: aprobado internamente, privado.
- `published`: visible solo si `isPublic=true`.
- `archived`: oculto y no público.

La landing pública `/capture/:id` puede mostrar contenido aplicado seguro:

- título comercial;
- descripción corta/larga;
- beneficios;
- CTA;
- puntos destacados publicados.

No expone:

- briefing comercial completo;
- runs IA;
- resultado IA completo;
- inputAssets privados;
- notas internas;
- costes;
- `tenantId`, `userId`, `leadId`;
- `sourceRunId`;
- QA interno completo.

Limitaciones actuales:

- No hay posicionamiento 3D dentro del iframe SuperSplat/Spark/Luma.
- Los hotspots públicos se muestran como panel/listado comercial junto al viewer.
- No hay publicación automática: publicar requiere cambiar estado a `published` e `isPublic=true`.

## Overlay interno de hotspots sobre viewer externo

La landing pública `/capture/:id` muestra hotspots publicados como una capa 2D propia de Immersphere sobre el iframe del viewer externo. No modifica SuperSplat, Spark, Luma ni la escena 3D. Los puntos viven en Immersphere y se renderizan encima del contenedor del viewer.

`CaptureHotspot.position` usa JSON con coordenadas porcentuales relativas al contenedor:

```json
{
  "mode": "overlay_2d",
  "x": 50,
  "y": 50,
  "anchor": "center",
  "mobileX": 50,
  "mobileY": 50
}
```

Reglas:

- `x` e `y` se normalizan entre 0 y 100.
- `mobileX` y `mobileY` son opcionales.
- Si no hay posición, la landing distribuye puntos en posiciones automáticas seguras.
- El overlay usa `pointer-events: none` salvo en los botones de hotspot, para no bloquear el iframe más de lo necesario.
- Click o foco en un punto abre una tarjeta flotante con label, zona, descripción, CTA, prioridad y tipo.
- Las tarjetas `Puntos destacados` se mantienen debajo como fallback móvil/accesible.

Limitación: no son coordenadas 3D nativas dentro del splat. El siguiente paso sería integrar hotspots nativos con un viewer propio o una API compatible del proveedor.

## Modo móvil inmersivo / Landscape Optimized Viewer

La landing pública `/capture/:id` optimiza el viewer para móvil sin modificar el proveedor externo:

- En móvil vertical, muestra una recomendación no intrusiva: girar el móvil para explorar con mayor amplitud.
- En móvil vertical, ofrece botón `Modo inmersivo`.
- La detección móvil no depende solo de `width <= 768`: usa dispositivo táctil (`pointer: coarse` o `maxTouchPoints`) y lado corto `<= 768`, por lo que un móvil horizontal sigue siendo mobile-like aunque su ancho supere 768px.
- Usa `visualViewport` cuando existe para recalcular `width/height` en `resize`, `orientationchange` y resize del visual viewport.
- En móvil horizontal, reduce márgenes, compacta elementos secundarios y aumenta la altura del viewer a `92dvh`.
- En modo inmersivo, el viewer se renderiza en un contenedor `fixed inset-0`, `100dvh`, fondo oscuro, botón `Salir` visible y scroll de body bloqueado mientras está activo.
- El overlay de hotspots sigue funcionando en modo normal e inmersivo.
- `mobileX` y `mobileY` se usan para ajustar la posición de hotspots en pantallas móviles cuando existen.

Zoom/cámara inicial:

- En proveedores externos embebidos por iframe, como SuperSplat, el zoom/cámara inicial depende del proveedor.
- Immersphere no modifica la escena externa ni inventa parámetros de cámara.
- La alternativa aplicada es contenedor amplio, vista no recortada, modo inmersivo y fallback para abrir el viewer externo cuando el usuario necesite control completo.

Camino futuro: viewer propio o integración con una API compatible para controlar cámara inicial, fit-to-view y hotspots nativos.

## Riesgos pendientes

- Ejecutar la migracion real requiere entorno de base de datos configurado.
- El repositorio no tenia `node_modules` instalados durante la implementacion, por lo que los comandos de build/typecheck requieren instalar dependencias fijadas.
- La entidad `Lead` no tiene `tenantId` directo; la validacion se hace por `Lead -> Property`.
- `publicUrl` puede apuntar a un destino externo; hoy se guarda como campo manual. No se valida SSRF porque no se hace fetch server-side de esa URL.
- La vista publica es deliberadamente minima y no sustituye al viewer principal.
- Un viewer externo puede bloquear iframe mediante cabeceras `X-Frame-Options` o CSP. En ese caso el fallback correcto es abrirlo en nueva pestaña.
- Las URLs externas deben estar publicadas y revisadas manualmente por el equipo antes de marcar `published`.

## Siguiente paso recomendado

Crear un CaptureJob piloto con una escena real de Supersplat o Spark, probar desktop y movil, medir carga percibida y decidir si se necesita una politica de embeds por dominio antes de permitir formatos 3D subidos a la plataforma.

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
