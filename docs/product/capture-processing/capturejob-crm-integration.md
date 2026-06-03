# CaptureJob / ProcessingJob - CRM Integration

Este documento define como CaptureJob se conectaria con el CRM comercial de Immersphere sin implementar integracion todavia.

## Objetivo

El CRM debe vender y hacer seguimiento. CaptureJob debe ordenar la operacion visual. La integracion debe unir ambos mundos sin convertir el CRM en una herramienta tecnica pesada ni el SaaS en una hoja comercial.

## Conexion con Immersphere CRM Comercial

- Leads: desde un lead se puede crear o vincular un CaptureJob cuando exista una oportunidad visual concreta.
- Presupuesto: los servicios y packs comerciales generan lineas; si se aceptan, pueden crear o priorizar un job.
- Propuesta: usa el estado del job para explicar material recibido, demo, QA, publicacion estimada o siguiente accion.
- Catalogo / tarifario: el catalogo define lo vendible; CaptureJob define ejecucion y entregables.

## Packs conectados

- Diagnostico Visual 360: job ligero de auditoria con informe y siguiente paso.
- Demo Inmersiva Premium: job de demo con landing, QA y seguimiento comercial.
- Propiedad 3D Premium: job de produccion con captura, experiencia, landing, QR y CRM.
- Showroom Inmersivo Pro: job de espacio comercial con recorrido, hotspots, CTA y analitica.
- Viewer QA & Optimizacion: job de revision con auditoria, QA movil, optimizacion e informe.
- Agente IA Comercial: recomienda mensajes y proximas acciones segun eventos reales, sin inventar estado tecnico.

## Informacion que debe pasar del CRM al CaptureJob

- `leadId`.
- Nombre del cliente.
- Empresa y contacto principal.
- Pack o servicios contratados.
- Presupuesto asociado.
- Propuesta asociada.
- Objetivo comercial.
- Fecha deseada de entrega.
- Prioridad comercial.
- Valor potencial.
- Canal preferido de comunicacion.
- Notas comerciales relevantes.
- Próxima acción acordada con el cliente.

## Informacion que debe volver del CaptureJob al CRM

- Estado actual del job.
- Material recibido o pendiente.
- Riesgo detectado.
- Fecha estimada de entrega.
- Entregables generados.
- URL publicada.
- QR generado.
- Resultado QA.
- Recomendacion de seguimiento.
- Bloqueos o decisiones necesarias.
- Coste interno estimado.
- Horas estimadas o consumidas.
- Senales de interes si hay analitica.

## Eventos comerciales a registrar

- `asset recibido`.
- `QA realizado`.
- `demo publicada`.
- `QR generado`.
- `propuesta enviada`.
- `cliente aprobado`.
- `seguimiento pendiente`.

## Uso para seguimiento comercial

- Si falta material, el CRM crea tarea de solicitud al cliente.
- Si QA esta aprobado, el comercial envia demo o agenda llamada.
- Si hay QR publicado, el comercial propone escaparate, WhatsApp o campana.
- Si el cliente aprueba, el CRM sugiere upsell o continuidad mensual.
- Si el job falla, el CRM registra motivo y alternativa: auditoria, nuevo material o alcance reducido.

## Reglas para no sobrecargar el CRM

- El CRM solo necesita estado, riesgo, entregables y siguiente accion.
- Los detalles tecnicos viven en CaptureJob.
- Los experimentos lab no deben aparecer como promesas comerciales.
- Las automatizaciones deben esperar a que el flujo manual sea estable.
