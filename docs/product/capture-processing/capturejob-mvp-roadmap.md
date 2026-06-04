# CaptureJob / ProcessingJob - MVP Roadmap

Este roadmap separa utilidad comercial, operacion interna y automatizacion tecnica. El objetivo es avanzar sin vender humo tecnico ni construir infraestructura antes de validar el flujo.

## Fase 0 - Manual

| Punto | Definicion |
| --- | --- |
| Objetivo | Ordenar el proceso con documentos, checklist y responsabilidad clara. |
| Que se implementa | Checklist manual, registro de jobs en documento o tabla, asociacion manual a lead/propuesta, estado visible y proxima accion. |
| Que no se implementa | No hay tabla real, uploads, workers, OCR, GPU, automatizacion ni componentes SaaS nuevos. |
| Riesgo | Que el proceso dependa demasiado de disciplina manual. |
| Prioridad | Alta. |
| Esfuerzo estimado | 1-3 dias de definicion y prueba operativa. |
| Criterio de exito | Se pueden gestionar 5-10 jobs reales sin perder estado, material ni siguiente accion. |

## Fase 1 - CRM asistido

| Punto | Definicion |
| --- | --- |
| Objetivo | Conectar oportunidad comercial y ejecucion visual dentro del CRM. |
| Que se implementa | Campos `assetPipeline` y `pipelineStatus` en CRM, actividad manual, generacion de proxima accion y packs conectados a presupuesto. |
| Que no se implementa | No hay procesamiento automatico, uploads SaaS ni tabla CaptureJob independiente. |
| Riesgo | Meter demasiada operacion tecnica dentro del CRM. |
| Prioridad | Alta si el CRM es el primer punto de venta. |
| Esfuerzo estimado | 3-7 dias segun estado actual del CRM. |
| Criterio de exito | Un comercial puede vender un pack, crear seguimiento y saber si el activo visual esta pendiente, en QA o publicado. |

## Fase 2 - SaaS basico

| Punto | Definicion |
| --- | --- |
| Objetivo | Crear CaptureJob como entidad real dentro de Immersphere Pro SaaS. |
| Que se implementa | Tabla CaptureJob, uploads controlados, estados, input assets, output assets, QR, landing y URL publicada. |

## Paso 15 + Paso 16

Se añade aplicación humana de sugerencias IA y hotspots públicos:

- aplicar copy IA al CaptureJob sin publicar automáticamente;
- guardar checklist operativo dentro de `appliedAiContent`;
- crear hotspots borrador desde `suggestedHotspots`;
- aprobar/publicar/ocultar/archivar hotspots manualmente;
- mostrar en `/capture/:id` solo contenido aplicado seguro y hotspots `published + isPublic`.
- mostrar hotspots publicados como overlay 2D interno sobre el viewer externo.
- optimizar `/capture/:id` en móvil con aviso de orientación horizontal, detección mobile-like robusta y modo inmersivo `100dvh`.

Queda fuera del MVP actual:

- posicionamiento dentro del iframe 3D;
- coordenadas 3D nativas dentro de SuperSplat/Spark/Luma;
- automatización de publicación;
- workers, OCR, GPU o generación automática Gaussian/Splat.
- control nativo de zoom/cámara inicial en iframes externos como SuperSplat.
| Que no se implementa | No hay GPU automatico, Matrix-3D, 360Gaussian integrado ni OCR productivo. |
| Riesgo | Construir demasiada plataforma antes de validar volumen. |
| Prioridad | Media-alta cuando haya jobs recurrentes. |
| Esfuerzo estimado | 2-4 semanas para una version util y prudente. |
| Criterio de exito | Produccion puede crear, revisar, publicar y vincular jobs sin depender de documentos externos. |

## Fase 3 - Lab

| Punto | Definicion |
| --- | --- |
| Objetivo | Probar tecnologias avanzadas en entorno controlado, sin prometerlas como produccion estable. |
| Que se implementa | PanoOCR PoC, 360Gaussian manual, LichtFeld/Matrix-3D demo, viewer QA avanzado y documentacion de riesgos. |
| Que no se implementa | No hay automatizacion comercial ni promesa de procesamiento masivo. |
| Riesgo | Confundir demos tecnicas con producto vendible. |
| Prioridad | Media. Alta solo si hay caso de uso pagado o ventaja clara. |
| Esfuerzo estimado | 2-6 semanas por linea de investigacion, segun alcance. |
| Criterio de exito | Cada prueba produce decision: copiar, adaptar, construir, pausar o descartar. |

## Fase 4 - Automatizacion controlada

| Punto | Definicion |
| --- | --- |
| Objetivo | Automatizar partes repetibles una vez que el proceso manual y SaaS sean estables. |
| Que se implementa | Workers, colas, analytics, webhooks, integracion CRM, validaciones y procesos asistidos. |
| Que no se implementa | No se automatizan decisiones de calidad, legales o comerciales sin supervision. |
| Riesgo | Coste tecnico alto, fallos silenciosos, deuda operativa y expectativas excesivas. |
| Prioridad | Media-baja hasta tener volumen suficiente. |
| Esfuerzo estimado | 1-3 meses por bloque, segun infraestructura existente. |
| Criterio de exito | La automatizacion reduce tiempo real sin aumentar errores, soporte ni riesgo comercial. |

## Que implementar primero

La recomendación es empezar por Fase 0 y Fase 1 ligera: checklist, estados, próxima acción y conexión con packs del CRM. Eso permite vender, ejecutar y aprender sin construir infraestructura pesada.

## Que dejar en stand by

- Procesamiento GPU automatico.
- Captura movil propia.
- OCR automatico en produccion.
- Matrix-3D en produccion.
- 360Gaussian embebido como flujo comercial.
- Workers y colas hasta tener volumen real.
- Automatizaciones que puedan prometer resultados no revisados.

## Paso 16D - Viewer-first mobile landscape

Se incorpora `CaptureViewerShell` para que `/capture/:id` no dependa solo de deteccion responsive:

- `/capture/:id` queda tratado como ruta viewer-aware en `AppLayout`.
- Desktop y movil vertical conservan landing comercial.
- Movil horizontal entra en modo viewer-first con viewport real, `100dvh`, fondo oscuro y controles minimos.
- Modo inmersivo reutiliza el mismo shell.
- Hotspots siguen como overlay 2D relativo al frame real.

Sigue fuera del MVP: controlar zoom/camara inicial internos de SuperSplat u otros iframes externos sin API documentada.

## Paso 25B - Viewer propio experimental .PLY

Se incorpora una via experimental y controlada para outputs `native_point_cloud` / `ply_viewer`:

- Viewer propio Three.js para archivos `.ply`, activado solo con `VITE_ENABLE_NATIVE_3D_VIEWER=true`.
- `/capture/:id` mantiene iframe/SuperSplat por defecto y solo usa el viewer nativo si el flag esta activo y el output publicado es compatible.
- `/capture-jobs` permite seleccionar un hotspot existente, hacer click sobre la nube `.ply`, guardar `position.mode = native_3d` y resetear a overlay automatico.
- `CaptureViewerShell` conserva overlays 2D y evita pintar como overlay los hotspots `native_3d`.
- No hay cambio Prisma porque `CaptureHotspot.position` ya es JSON.

Queda fuera:

- Picking nativo real sobre `.splat`, `.spz` o viewers externos.
- Sustituir SuperSplat/Spark/Luma.
- Automatizar conversiones o procesado pesado de nubes.

## Paso 25C - Viewer propio Gaussian/Splat experimental

Se añade una ruta controlada para probar SparkJS como viewer propio de splats:

- Activacion solo con `VITE_ENABLE_NATIVE_SPLAT_VIEWER=true`.
- Tipos permitidos: `native_splat`, `gaussian_splat_native`, `spark_splat_viewer`, `splat_native`.
- No se activa para `gaussian_splat` existente, que conserva SuperSplat/iframe.
- El viewer proyecta hotspots `native_3d` a pantalla con la camara propia.
- En editor privado intenta picking real con `SplatMesh.raycast`.
- Si no hay interseccion, puede guardar `approximate_ray` con `confidence: low`.

Riesgos:

- Raycasting en splats grandes puede tener coste.
- Hay que validar con assets reales publicos y dispositivos moviles.
- Los formatos declarados por SparkJS no implican que todos los pipelines de subida internos los acepten.

Proximos pasos:

- Medir rendimiento por formato y tamaño.
- Confirmar picking real con muestras `.splat/.spz/.ksplat`.
- Definir camara inicial por estancia.
- Diseñar editor visual avanzado y analitica por hotspot.

## Paso 17 - Landing comercial premium desde CaptureJob

La landing publica `/capture/:id` deja de ser solo una ficha tecnica y pasa a funcionar como entrega comercial:

- Hero premium con copy aplicado por IA y aprobado manualmente.
- Viewer 3D como pieza central.
- Beneficios comerciales desde `appliedAiContent.benefits`.
- Hotspots publicados como overlay y como fallback accesible.
- Seccion compacta de confianza tecnica.
- Bloque final de conversion con CTA preparado.

Se mantiene fuera del MVP actual:

- formulario publico real de lead capture;
- analitica de conversion;
- automatizacion de follow-up;
- control nativo de camara/zoom de iframes externos;
- publicacion automatica de contenido IA sin revision humana.

## Paso 19 - Lead capture real en landing publica

La landing publica `/capture/:id` captura solicitudes reales sin login:

- formulario ligero integrado en la seccion final de conversion;
- endpoint publico seguro `POST /api/capture-jobs/public/:captureJobId/leads`;
- persistencia en `CaptureLead`;
- asociacion directa con `CaptureJob` y `Tenant`;
- validacion de nombre, email, consentimiento, honeypot y tipo de interes;
- anti-spam basico por email/CaptureJob en ventana de 10 minutos;
- respuesta publica generica sin exponer datos privados.

Queda fuera de este paso:

- email/notificaciones;
- sincronizacion automatica con CRM;
- bandeja privada de CaptureLeads;
- scoring, analytics y exportacion.

## Paso 20 - QR y entrega cliente

La entrega comercial queda preparada para uso real:

- bloque privado "Entrega cliente" en `/capture-jobs`;
- enlace canonico `/capture/:id`;
- generacion/actualizacion de QR desde backend;
- copia y descarga del QR;
- modo presentacion con `?present=1`;
- ficha imprimible con `?print=1`;
- acciones publicas de compartir, copiar enlace, inmersivo y solicitud de informacion.

Esto reduce friccion comercial sin tocar el viewer externo ni anadir infraestructura.

## Paso 21 - Material guiado privado

El MVP incorpora captura guiada de material por zona:

- zona/estancia, tipo de asset, estado de calidad y notas;
- resumen global y por zona para saber si falta material;
- subida o URL manual usando endpoints existentes;
- input assets privados, no expuestos en la landing publica;
- IA alimentada con metadatos resumidos, no con binarios.

Queda fuera de este paso: OCR, descarga automatica de assets, modelo de hotspots nuevo y automatizacion multiworker.

## Paso 22 - Demo publica premium en /ayuda

`/ayuda` incorpora ASAS como demo comercial validada:

- enlace principal `/capture/a5924f50-7e7b-4173-95d3-23dae72e5cae`;
- modo presentacion con `?present=1`;
- ficha imprimible con `?print=1`;
- explicacion de landing premium, viewer 3D, hotspots, mobile landscape, IA aplicada, lead capture, QR y upload guiado;
- timeline del flujo completo desde CaptureJob hasta lead;
- limitaciones controladas para no prometer hotspots nativos dentro del `.splat` ni control de camara del proveedor externo.

La pagina diferencia:

- demos tecnicas: prueban integraciones concretas;
- demo comercial ASAS: prueba una entrega vendible end to end.

Siguientes pasos: analitica, CRM, white label y viewer propio/API compatible para control nativo.

## Paso 23 - Control de uso y costes IA

El MVP incorpora una barrera operativa de coste para CaptureJob AI:

- limites diarios por tenant segun plan;
- bloqueo backend antes de crear runs si el limite esta agotado;
- switch de emergencia `CAPTURE_AI_DISABLE_PROCESSING`;
- endpoint privado de uso para `/capture-jobs`;
- resumen de tokens y coste estimado del dia;
- aviso visual cuando el tenant se acerca al limite.

Defaults actuales:

- Starter: 5 runs IA/dia.
- Pro/Professional: 30 runs IA/dia.
- Enterprise: 150 runs IA/dia.
- Plan desconocido: 10 runs IA/dia.

Queda fuera de este paso:

- facturacion por uso;
- Stripe metered billing;
- alertas por email/Slack;
- panel historico mensual;
- exportacion CSV;
- presupuestos por usuario o proyecto.

## Paso 24 - Worker / cola IA

El procesamiento IA pasa a arquitectura de cola simple DB-backed:

- el endpoint privado encola runs `queued`;
- un worker interno arranca con el servidor si `CAPTURE_AI_WORKER_ENABLED=true`;
- el worker toma runs con lock condicional en base de datos;
- retries controlados con `attempts/maxAttempts`;
- recuperacion de runs `running` atascados;
- cancelacion best-effort;
- reintento manual desde `/capture-jobs`.

Se mantiene fuera:

- Redis/BullMQ;
- dashboard admin de cola;
- metricas Prometheus;
- alertas operativas;
- workers separados por proceso;
- cancelacion dura de llamadas Anthropic ya iniciadas.
