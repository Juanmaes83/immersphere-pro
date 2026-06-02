# Spatial AI Master Audit - Immersphere Pro

## Resumen ejecutivo

La investigacion confirma que Immersphere Pro debe diferenciarse como sistema completo de ventas espaciales: captura/asset visual, landing, analytics, CRM, agentes IA, propuestas y seguimiento. Travvir es el benchmark mas importante en captura smartphone y SDK, pero su SDK es propietario y solo encaja via partnership/licencia. PanoOCR es el activo open source mas accionable para enriquecer tours 360 con metadata visual. Matrix-3D es una linea potente de I+D generativa, no produccion inmediata. El mapa competitivo 360 es util para argumentario y posicionamiento, con precios a revalidar.

## Fuentes analizadas

| Fuente | Leido/inspeccionado | Estado legal | Clasificacion | Conclusion |
|---|---|---|---|---|
| https://travvir.com | Web publica | Propietario | B/C | Benchmark de spatial AI y captura |
| https://travvir.com/docs | SDK docs Android/iOS/API/licencia | Propietario restrictivo | C | No copiar SDK; contactar |
| https://travvir.com/enterprise | Enterprise/iframe/verticales | Propietario | B | Adaptar ideas de workflow |
| https://travvir.com/pricing | Pricing pay-as-you-go | Publico/inspirable | B | Inspirar add-ons |
| https://github.com/Travvir | Repos publicos | Mixto | A/B/D/E | Solo panoocr fuerte |
| Travvir/panoocr | Clonado, README/LICENSE/pyproject | MIT | A/B | PoC OCR 360 |
| SkyworkAI/Matrix-3D | Clonado, README/LICENSE/scripts | MIT repo; modelos a revisar | D | Generative 3D Lab |
| gadlol/360-Virtual-Tour-Creator-Softwares | Clonado, README/LICENSE | MIT | A/B | Mapa competitivo |

## Copiar / Adaptar / Desarrollar / Descartar

| Decision | Elementos |
|---|---|
| Copiar/reutilizar legalmente | panoocr MIT; Matrix-3D MIT para lab; mapa competitivo MIT con atribucion |
| Adaptar/inspirar | Travvir capture flow, SDK onboarding, iframe analytics, partner program, pricing add-ons |
| Desarrollar nosotros | Capture sessions, OCR worker integrado, CRM competitive intelligence, embed analytics, docs propias |
| Partnership/licencia | Travvir SDK mobile, capture services, white-label enterprise |
| Descartar/no usar | Travvir SDK sin contrato; `360-thumbnail` sin licencia clara; segmentation_idm en produccion; claims/precios no verificados |

## Hallazgos clave

1. El mercado se mueve de "tour 360" a "spatial AI".
2. La captura smartphone es una ventaja competitiva fuerte, pero cara de construir.
3. Immersphere ya tiene una ventaja que muchos builders no tienen: CRM, lead capture, propuestas y agente comercial.
4. OCR sobre panoramas puede crear una nueva capa de metadata y hotspots sugeridos.
5. Matrix-3D puede ayudar a vender vision premium, pero debe separarse de producto estable.
6. El benchmark competitivo debe entrar en el CRM como argumento y objeciones.

## Impacto en Immersphere Pro SaaS

- Añadir pipeline de `captureSession`: estados, metadata, progreso, asset resultante.
- Añadir OCR metadata para assets 360.
- Mejorar iframe con analytics por embed y campaign tags.
- Documentar API/webhooks propios.
- Preparar planes/add-ons por activo, reels, Google Maps, white-label, OCR.

## Impacto en Immersphere Pro Inmobiliarias

- Pitch: "visita virtual que captura y sigue leads".
- Paquetes: piloto propiedad, pack mensual, premium con OCR/analytics, migracion desde Matterport/Kuula.
- Landing: comparar por problema: publicar, captar, medir, cerrar.
- Demos: QR escaparate + tour + Vera + seguimiento CRM.

## Impacto en CRM Comercial

- Añadir fuente de lead: QR, iframe, partner, capture session, web, demo.
- Añadir campo "herramienta actual": Matterport, Kuula, CloudPano, 3DVista, otra.
- Añadir objeciones competitivas.
- Añadir recomendador de pitch segun competidor.
- Añadir panel "Competitive Intelligence" con fichas de herramientas.

## Impacto en Agente IA Comercial

- Usar metadata OCR aprobada como contexto del lead/tour.
- Sugerir argumento competitivo segun herramienta actual del prospecto.
- Generar mensajes por vertical: inmobiliaria, hotel, showroom, retail, museo.
- Sugerir add-on: OCR, QR, embed analytics, tour offline, Google Maps.

## Roadmap recomendado

| Horizonte | Accion | Prioridad |
|---|---|---|
| 0-30 dias | CRM objeciones competitivas + fichas competidor | Alta |
| 0-30 dias | PoC panoocr sobre una panoramica | Alta |
| 0-30 dias | Spec capture sessions | Alta |
| 30-90 dias | Hotspots sugeridos por OCR | Alta |
| 30-90 dias | Embed analytics por iframe/campaign | Alta |
| 30-90 dias | Partner Studio | Media |
| 90-180 dias | Matrix-3D GPU demo | Media |
| 90-180 dias | Contacto/licencia Travvir | Media/alta |

## Riesgos legales

- No copiar SDK privado ni fragmentos propietarios de Travvir.
- No hacer reverse engineering ni saltarse login/paywalls.
- Mantener avisos MIT si se reutiliza panoocr, Matrix-3D o competitor map.
- Revisar licencias de modelos OCR/Matrix antes de produccion.
- No usar marcas de competidores como endorsement.

## Riesgos tecnicos

- OCR puede ser lento o impreciso.
- Matrix-3D requiere GPU y no garantiza espacios comercialmente exactos.
- Capture app propia implica mobile, sensores, upload, bateria y soporte.
- Integrar Python workers en stack Node requiere colas y observabilidad.

## Proximas acciones

1. Crear PoC PanoOCR local con RapidOCR.
2. Diseñar tablas/DTO de OCR metadata y capture sessions.
3. Añadir al CRM campos de competidor/herramienta actual y objeciones.
4. Crear landing/pitch "Spatial Sales OS".
5. Contactar Travvir para SDK/partnership.
6. Preparar Matrix-3D como demo interna con disclaimers.
7. Mantener matriz competitiva revisada trimestralmente.

