# CaptureJob / ProcessingJob - Functional Data Model

Este documento define un modelo funcional. No es un contrato final de base de datos ni una migracion. Sirve para acordar que informacion debe existir antes de decidir si se implementa en CRM, SaaS o proceso manual.

## CaptureJob

| Campo | Significado |
| --- | --- |
| `id` | Identificador unico del job. |
| `title` | Nombre visible del trabajo, por ejemplo "Demo 360 villa premium". |
| `clientName` | Nombre del cliente o empresa. |
| `leadId` | Relacion opcional con un lead del CRM comercial. |
| `propertyId` | Relacion opcional con una propiedad, espacio o activo del SaaS. |
| `projectType` | Tipo de proyecto: propiedad, showroom, hotel, restaurante, espacio comercial, lab o material existente. |
| `vertical` | Vertical comercial principal: inmobiliaria, hospitality, retail, salud, showroom, lab u otra. |
| `status` | Estado actual del flujo. |
| `priority` | Prioridad operativa: baja, media, alta o urgente. |
| `source` | Origen del job: CRM, presupuesto, cliente directo, demo interna, subida manual o lab. |
| `inputAssets[]` | Lista de materiales recibidos o pendientes. |
| `outputAssets[]` | Lista de entregables generados o previstos. |
| `assignedTo` | Responsable interno del siguiente avance. |
| `createdAt` | Fecha de creacion. |
| `updatedAt` | Fecha de ultima actualizacion. |
| `dueDate` | Fecha objetivo de entrega o siguiente hito. |
| `estimatedCost` | Coste interno estimado. |
| `estimatedHours` | Horas estimadas de trabajo. |
| `commercialValue` | Valor comercial estimado del job: importe, oportunidad o impacto. |
| `riskLevel` | Riesgo operativo: bajo, medio, alto o bloqueante. |
| `notes` | Notas internas relevantes. |
| `nextAction` | Siguiente accion concreta para ventas, produccion o QA. |

## InputAsset

| Campo | Significado |
| --- | --- |
| `id` | Identificador unico del asset de entrada. |
| `type` | Tipo de material: foto, video, panorama360, render, ply, spz, sog, html, link o documento. |
| `filename` | Nombre del archivo si existe. |
| `url` | Enlace de descarga, visualizacion o almacenamiento. |
| `source` | Origen del material: cliente, captura propia, proveedor, drive, web externa o lab. |
| `format` | Formato tecnico: jpg, png, mp4, mov, equirectangular, ply, spz, sog, html u otro. |
| `size` | Peso aproximado del archivo. |
| `status` | Estado del asset: recibido, pendiente, rechazado, aprobado, necesita revision o reemplazado. |
| `rightsStatus` | Estado de derechos: confirmado, pendiente, limitado, desconocido o no usable. |
| `qualityScore` | Valor orientativo de calidad visual o utilidad comercial. |
| `notes` | Observaciones: falta resolucion, mala luz, enlace roto, permiso pendiente, etc. |

## OutputAsset

| Campo | Significado |
| --- | --- |
| `id` | Identificador unico del entregable. |
| `type` | Tipo de salida: landing, viewer, qr, informeQA, propuesta, assetOptimizado, metadata o tracking. |
| `format` | Formato de salida: html, url, pdf, png, json, zip u otro. |
| `url` | Enlace interno o externo del entregable. |
| `status` | Estado: previsto, en_progreso, listo, en_revision, aprobado, publicado o archivado. |
| `viewerReady` | Indica si el activo esta listo para visor. |
| `mobileReady` | Indica si ha pasado revision movil. |
| `publishedUrl` | URL pública si ya está publicado. |

### Contenido IA aplicado

`CaptureJob` puede guardar `appliedAiContent` como JSON aprobado manualmente desde un run IA completado. El contenido aplicado incluye título comercial, descripciones, beneficios, CTAs, resumen de guion, checklist operativo y `sourceRunId` privado.

Campos:

| Campo | Uso |
| --- | --- |
| `appliedAiContent` | JSON privado con copy/checklist aplicado por humano. |
| `appliedAiContentUpdatedAt` | Fecha de última aplicación. |

### CaptureHotspot

Modelo persistente para convertir sugerencias IA o entradas manuales en hotspots operativos.

| Campo | Uso |
| --- | --- |
| `captureJobId` | CaptureJob propietario. |
| `tenantId` | Validación multi-tenant. |
| `sourceRunId` | Run IA origen, privado y opcional. |
| `label` / `description` | Contenido visible del hotspot. |
| `roomOrZone` | Zona comercial o estancia. |
| `hotspotType` | info, cta, navigation, feature o warning. |
| `priority` | low, medium o high. |
| `cta` | CTA opcional visible si se publica. |
| `position` | JSON reservado para posicionamiento futuro. |
| `status` | draft, approved, published o archived. |
| `isPublic` | Solo visible públicamente con `status=published`. |
| `sortOrder` | Orden en landing/listado. |
| `qrUrl` | URL del QR generado o asset asociado. |
| `analyticsEnabled` | Indica si el activo tiene seguimiento de visitas, clics o eventos. |
| `notes` | Notas de entrega, limitaciones o mejoras pendientes. |

## QualityChecklist

| Campo | Significado |
| --- | --- |
| `mobile` | Valida que la experiencia funciona correctamente en movil. |
| `loadingSpeed` | Revisa si el tiempo de carga es aceptable para uso comercial. |
| `visualQuality` | Evalua nitidez, luz, encuadre, compresion y coherencia visual. |
| `navigation` | Comprueba que el usuario entiende como moverse por el activo. |
| `CTA` | Revisa que la llamada a la accion es visible y util. |
| `legalRights` | Confirma permisos de uso del material. |
| `privacy` | Revisa si aparecen datos, personas, matriculas o informacion sensible. |
| `clientApproval` | Marca si el cliente ha aprobado la version lista para publicar. |

## ProcessingJob

ProcessingJob puede vivir como subestado o bloque operativo dentro de CaptureJob. No necesita entidad separada en Fase 0. Si el SaaS crece, puede convertirse en tabla propia.

- `id`: identificador del proceso.
- `captureJobId`: job principal asociado.
- `type`: revision, optimizacion, conversion, QA, publicacion o lab.
- `status`: pendiente, en_progreso, bloqueado, listo, fallido o cancelado.
- `operator`: persona o sistema responsable.
- `inputAssetIds[]`: assets usados.
- `outputAssetIds[]`: assets generados.
- `startedAt`: inicio.
- `completedAt`: finalizacion.
- `failureReason`: motivo si falla.
- `notes`: observaciones tecnicas o comerciales.

## Reglas funcionales iniciales

- Un CaptureJob puede existir sin `propertyId`, pero no sin titulo, cliente o fuente.
- Un job no debe pasar a `ready_for_processing` si no hay material minimo.
- Un output publicado debe tener revision QA previa.
- Un QR no debe considerarse listo si no existe URL publicada o destino definido.
- Los jobs de lab deben estar marcados con riesgo y no mezclarse con produccion.
