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
