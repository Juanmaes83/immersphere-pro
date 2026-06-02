# 360Gaussian Integration Opportunities for Immersphere Pro

## Resumen Ejecutivo

360Gaussian no debe integrarse como binario dentro de Immersphere Pro, pero sus conceptos pueden mejorar el roadmap. La oportunidad real es crear un "Immersphere Capture / Gaussian Lab": pipeline propio o semi-manual que convierta video/360 en assets 3D publicables, conectados a landing, CRM, analitica y propuestas.

## Immersphere Pro SaaS

Oportunidades:

- Crear entidad `CaptureJob` o `ProcessingJob`.
- Estados: `uploaded`, `frames_extracted`, `aligned`, `training`, `exported`, `published`, `failed`.
- Soportar outputs PLY/SPZ/SOG/HTML como assets.
- Dashboard de procesamiento con logs, coste, tiempo y calidad.
- Viewer fallback: si Gaussian no carga en movil, mostrar panorama 360.
- Embed del resultado final con analytics.

Accion recomendada: PROBAR EN LAB primero; despues desarrollar pipeline propio.

## Immersphere Pro Inmobiliarias

Oportunidades:

- Producto "Propiedad Gaussian Premium": video 360 -> splat -> landing -> QR -> CRM.
- Demos para villas, showrooms, reformas premium y promociones.
- Argumento: "del video al recorrido 3D comercial".
- Captura con marcadores para mejorar escala/alineacion.

Accion recomendada: crear demo piloto con una propiedad propia o demo, no cliente real hasta validar resultados.

## CRM Comercial

Oportunidades:

- Campo `assetPipeline`: panorama, video, gaussian, PLY, SPZ.
- Campo `pipelineStatus`.
- Actividad automatica: "Asset 3D generado", "Landing publicada", "QR listo".
- Objeciones: "No tenemos Matterport", "Es muy tecnico", "No tengo camara 360".
- Scoring: leads con propiedad premium + web + interes visual alto.

Accion recomendada: adaptar como idea en CRM; no requiere ejecutar 360Gaussian.

## Agente IA Comercial

Oportunidades:

- Generar propuesta segun pipeline: captura, procesado, landing, seguimiento.
- Sugerir paquete adecuado segun sector y tipo de asset.
- Explicar limites: "demo conceptual", "requiere procesamiento", "no promete venta".
- Crear checklist para captura: limpiar espacio, luz, recorrido, evitar personas, usar marcadores si se necesita escala.

Accion recomendada: implementar ahora como conocimiento/documentacion del agente comercial.

## Catalogo / Tarifario

| Pack | Descripcion | Precio orientativo | Estado |
|---|---|---:|---|
| Gaussian Lab Demo | Procesado manual de un video/espacio para demo | 450-900 EUR | Lab |
| Propiedad 3D Premium | Captura + Gaussian + landing + QR + CRM | 900-1800 EUR | Piloto |
| Showroom Inmersivo Pro | Recorrido 3D + hotspots + landing comercial | 1500-3500 EUR | Piloto |
| Pipeline Audit | Diagnostico de material 360 existente y viabilidad GS | 250-500 EUR | Implementable |
| Conversion + Viewer QA | Test de PLY/SPZ/SOG en visor Immersphere | 350-750 EUR | Lab |

## Demos Premium

- Villa premium.
- Showroom de mobiliario.
- Reforma antes/despues.
- Hotel/habitacion suite.
- Museo/espacio cultural.

## Laboratorio Generative 3D

360Gaussian complementa otras lineas:

- 360Gaussian: pipeline practico desktop.
- LichtFeld/Brush/Postshot: entrenamiento/export.
- Matrix-3D: generacion conceptual.
- PanoOCR: metadata visual posterior.

Roadmap sugerido: `Immersphere Lab: Capture + Generate + Understand + Sell`.

## Que Desarrollar Nosotros

1. Modelo de datos de jobs.
2. UI de estado de procesamiento.
3. Integracion de assets generados al viewer.
4. Pipeline legal con herramientas open source separadas.
5. QA mobile y fallback.
6. Conector CRM/propuesta.

## Veredicto

360Gaussian aporta mas valor como "reverse product prompting" que como componente. La oportunidad es replicar legalmente el flujo con desarrollo propio y herramientas open source revisadas, mientras se usa 1.4.4 como laboratorio manual para aprender y crear demos.

