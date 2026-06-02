# 360Gaussian-1.4.4 Master Audit

## Resumen Ejecutivo

360Gaussian-1.4.4 si interesa para Immersphere Pro, pero no como codigo integrable directamente. La carpeta local contiene siete builds Windows empaquetados de 360Gaussian, una herramienta freeware de Laskos Virtuals para convertir material 360/video/imagenes en pipelines de Structure-from-Motion y Gaussian Splatting usando SphereSfM/COLMAP, RealityScan/RealityCapture, Postshot, LichtFeld Studio, Brush, Metashape y AutoMasker.

La licencia principal permite usar el software gratis para uso personal y comercial, redistribuir el paquete sin modificar y crear splats derivados. Pero prohibe modificar, decompilar, desensamblar, hacer reverse engineering, vender el software o incluirlo dentro de un producto comercial. Por tanto: no copiar codigo, no integrar el ejecutable en Immersphere Pro SaaS, no desmontarlo. Si aporta valor, usarlo como herramienta de laboratorio o referencia de producto, y desarrollar nuestro propio pipeline legalmente.

## Que Es 360Gaussian-1.4.4

Un paquete Windows standalone, probablemente creado con PyInstaller, que orquesta herramientas de reconstruccion 360/3D:

- Extraccion de frames desde video con FFmpeg.
- Filtrado de frames nitidos con Tenengrad/sharp frame extractor.
- Conversion/cubemap/splitting de panoramas 360.
- Alineacion/SfM con SphereSfM/COLMAP y opcionalmente RealityScan, Metashape o COLMAP externo.
- Entrenamiento/export con Postshot, LichtFeld Studio o Brush.
- Exportacion de PLY y, en versiones recientes, SOG/SPZ/HTML segun configuracion LichtFeld.
- Marcadores RealityCapture/AprilTags para escalado/alineacion.
- Opciones AutoMasker con GroundingDINO/SAM segun rutas configurables.

## Estructura Detectada

Raiz analizada: `C:\Users\temp123\Downloads\360Gaussian-1.4.4`

| Carpeta principal | Archivos aprox. | Tamano aprox. | Contenido raiz |
|---|---:|---:|---|
| `360Gaussian_V1.0` | 2239 | 902.7 MB | build inicial anidado, ejecutable, `_internal` |
| `360Gaussian_V1.1.1` | 2514 | 1124.8 MB | build anidado, ejecutable, marcadores, `_internal` |
| `360Gaussian-1.2.0` | 2515 | 1133.3 MB | `360Gaussian.exe`, `updater.exe`, `RC_Markers`, `_internal` |
| `360Gaussian-1.3.0` | 2383 | 1002.5 MB | build anidado |
| `360Gaussian-1.4.0` | 2600 | 1353.4 MB | `360Gaussian.exe`, `updater.exe`, `RC_Markers`, `_internal` |
| `360Gaussian-1.4.3` | 2611 | 1363.8 MB | `360Gaussian.exe`, `updater.exe`, `RC_Markers`, `_internal` |
| `360Gaussian-1.4.4` | 4086 | 1408.3 MB | `360Gaussian.exe`, `updater.exe`, `RC_Markers`, `_internal` |

Tambien existen siete ZIPs correspondientes. No se han ejecutado, movido ni modificado.

## Hallazgos Clave

1. Es una herramienta de pipeline, no un viewer web ni una app SaaS.
2. La version 1.4.4 declara release date `20-04-2026`, SHA256 y firma.
3. El producto raiz tiene licencia freeware restrictiva: uso permitido, integracion/copia de codigo no.
4. El paquete incluye componentes open source: FFmpeg LGPL, SphereSfM/COLMAP BSD, Qt5 LGPL, Boost, Ceres, OpenEXR, OpenCV, NumPy, SciPy, pycolmap, Plotly, Flask, Dash, Open3D y otros.
5. `batch_pipeline_config.ini` revela una arquitectura util: video settings, Postshot, AutoMasker, COLMAP, SphereSfM, Brush, LichtFeld y Metashape.
6. No hay `package.json`, `requirements.txt`, `pyproject.toml` o fuente raiz del producto. Hay dependencias vendorizadas y metadata de paquetes.
7. No se detecta viewer WebGL/Three.js propio para reutilizar. Dash/React aparecen como dependencias de Dash.

## Valor Para Immersphere Pro

Alto como inteligencia de pipeline y laboratorio. Bajo como codigo reutilizable.

- Ayuda a definir `Immersphere Capture Pipeline`: media queue, frame extraction, sharpness filter, split/cubemap, SfM, training, export.
- Sugiere un flujo comercial para "servicio Studio": procesar videos 360 o panoramas y entregar Gaussian Splat/PLY.
- Identifica formatos y herramientas que conviene soportar: PLY, SOG, SPZ, HTML, Postshot, LichtFeld, Brush.
- Inspira UI de pipeline con perfiles, calidad, GPU, batch, auto-continue, masking y export.
- Sirve para pruebas controladas en laboratorio, no para Vercel/GitHub Pages.

## Que Podemos Usar

| Elemento | Uso recomendado |
|---|---|
| Software 360Gaussian sin modificar | Usarlo internamente como herramienta de laboratorio o produccion manual de assets, respetando licencia |
| Splats/PLY creados con la herramienta | Usarlos comercialmente como derivados permitidos |
| Ideas del pipeline | Adaptarlas con desarrollo propio |
| Licencias de terceros | Estudiar componentes open source por separado |
| Configuracion de flujo | Usarla como referencia conceptual, no copiar codigo propietario |

## Que No Podemos Usar

- No copiar ni modificar `360Gaussian.exe`.
- No decompilar/desensamblar ni extraer logica interna.
- No vender 360Gaussian ni incluirlo dentro de Immersphere Pro como producto comercial.
- No redistribuir versiones modificadas.
- No asumir que rutas a Postshot, RealityScan, Metashape, Brush o LichtFeld cubren sus licencias comerciales.

## Roadmap Recomendado

| Horizonte | Accion | Prioridad |
|---|---|---|
| Ahora | Documentar como referencia y lab | Alta |
| Ahora | Crear checklist de pipeline Immersphere Capture basado en etapas detectadas | Alta |
| 0-30 dias | Probar 1.4.4 manualmente en equipo aislado con video demo propio | Media |
| 0-30 dias | Validar salida PLY/SPZ/SOG y compatibilidad con visor Immersphere | Alta |
| 30-90 dias | Desarrollar pipeline propio: upload -> extract frames -> COLMAP/SphereSfM -> trainer externo -> export | Media |
| 30-90 dias | Definir producto "Immersphere Lab Gaussian Capture" | Media |

## Veredicto Final

360Gaussian-1.4.4 interesa como herramienta de laboratorio, referencia de arquitectura y posible apoyo manual para crear demos premium. No es implementacion inmediata dentro del SaaS, no es copiable como codigo y no debe integrarse en el producto comercial por su licencia freeware restrictiva. Lo que merece entrar en roadmap es el pipeline conceptual: captura/video, frame extraction, sharpness filtering, alignment/SfM, masking, Gaussian training, export y publicacion en landing/CRM.

