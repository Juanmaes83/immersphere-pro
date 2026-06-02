# CaptureJob / ProcessingJob - Functional Spec

## Resumen ejecutivo

CaptureJob / ProcessingJob define el proceso funcional para recibir material visual, revisarlo, prepararlo, convertirlo en activos comerciales y conectarlo con ventas. No es una integracion tecnica pesada todavia. Es una capa de operacion y producto para ordenar el trabajo antes de automatizarlo.

El objetivo es que Immersphere Pro pueda gestionar, con criterio comercial, trabajos de captura, subida, procesamiento, QA, exportacion, publicacion, analitica y seguimiento CRM.

## Que es CaptureJob / ProcessingJob

CaptureJob es el contenedor principal del encargo visual. Representa el trabajo desde que se recibe una oportunidad o material hasta que queda publicado, aprobado o archivado.

ProcessingJob es la fase operativa dentro del CaptureJob donde se revisan, preparan, optimizan o transforman los materiales. Al inicio puede ser manual o asistida por checklist. Mas adelante podra conectarse con procesos de laboratorio, workers o herramientas especializadas.

## Por que lo necesitamos

Immersphere Pro ya combina visor, tours, leads, QR, analitica y potencial SaaS. Sin un modelo de job, cada proyecto visual queda disperso entre CRM, archivos, notas, presupuesto y entrega. CaptureJob permite convertir cada oportunidad visual en un proceso claro, medible y repetible.

## Que problema resuelve

- Evita perder material, contexto o decisiones entre ventas y produccion.
- Permite saber si un activo esta pendiente de material, en QA, aprobado o publicado.
- Conecta packs comerciales con entregables reales.
- Ayuda a estimar coste, horas, riesgo y valor comercial.
- Prepara el terreno para automatizacion futura sin prometer procesamiento automatico antes de tiempo.

## Casos de uso

- Propiedad inmobiliaria: una vivienda premium se convierte en job con fotos, panorama, landing, QR, QA y aprobacion.
- Showroom: un espacio fisico se transforma en recorrido con zonas, hotspots, CTA y analitica.
- Hotel / restaurante: habitaciones, salon, terraza o experiencia de cliente se gestionan por zonas y objetivos.
- Espacio comercial: clinica, tienda, centro deportivo o stand con recorrido previo a la visita.
- Material 360 existente: auditoria de panoramas, tours, renders o links para decidir que reutilizar.
- Demo lab: prueba controlada de PanoOCR, 360Gaussian, Matrix-3D, LichtFeld o viewer QA, separada de produccion.

## Que entra en un job

- Fotos.
- Videos.
- Panoramas 360.
- Renders.
- Links externos.
- Archivos PLY, SPZ, SOG o HTML.
- Material comercial del cliente.
- Brief, notas, permisos, objetivos y restricciones.

## Que sale de un job

- Landing.
- Viewer.
- Asset optimizado.
- Informe QA.
- QR.
- Propuesta comercial.
- Metadata.
- Lead tracking.
- Recomendacion de siguiente accion.

## Que no hace todavia

- No hace procesamiento GPU automatico.
- No incluye captura movil propia.
- No ejecuta OCR automatico en produccion.
- No pone Matrix-3D en produccion.
- No embebe 360Gaussian como flujo operativo.
- No sustituye aprobacion humana.
- No automatiza decisiones comerciales sensibles.

## Principios

### Primero manual/asistido

La primera version debe funcionar con checklist, estado, notas y responsabilidad clara. El valor inicial es ordenar el proceso.

### Luego semiautomatico

Cuando el flujo manual sea estable, se pueden anadir ayudas: proxima accion, validaciones, generacion de QR, plantillas de QA y vinculacion con presupuesto.

### Luego automatizacion controlada

Solo cuando existan datos, criterios y riesgos conocidos, se conectaran workers, colas, analytics, webhooks o herramientas de laboratorio.

## Cliente final vs operacion interna

Para el cliente final, CaptureJob no debe sonar a tecnologia compleja. Debe traducirse en claridad: material recibido, demo preparada, revision pendiente, QR generado o publicacion lista.

Para operacion interna, CaptureJob es el tablero donde ventas, produccion y QA comparten estado, coste, riesgo, siguiente accion y entregables.
