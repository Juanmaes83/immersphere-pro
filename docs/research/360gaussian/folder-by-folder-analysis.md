# 360Gaussian Folder-by-Folder Analysis

## Resumen Ejecutivo

Las siete carpetas principales son versiones empaquetadas del mismo producto. La version 1.4.4 es la referencia para cualquier prueba; las anteriores sirven para entender evolucion. Todas apuntan a un producto Windows standalone con ejecutable, dependencias internas, herramientas SfM/video, marcadores y configuracion de pipeline.

## Tabla Carpeta Por Carpeta

| Carpeta | Que contiene | Para que sirve | Tecnologia | Tipo | Archivos clave | Utilidad Immersphere | Riesgo tecnico | Riesgo legal | Ejecutable/integrable | Accion |
|---|---|---|---|---|---|---|---|---|---|---|
| `360Gaussian_V1.0` | Build inicial anidado con `360 Gaussian.exe`, `_internal`, FFmpeg y marcadores | Primer pipeline standalone | Python empaquetado, EXE Windows, FFmpeg, Tk | Tool/lab | `360 Gaussian.exe`, `ffmpeg.exe`, `3DGS_ply.xml` | Baja/media: historico | Alto por antiguedad | C: licencia no localizada en V1.0 durante auditoria | Ejecutable Windows; no integrable en SaaS | Documentar |
| `360Gaussian_V1.1.1` | Build anidado con `360Gaussian.exe`, `RC_Markers`, `_internal`, COLMAP/SphereSfM | Pipeline temprano con marcadores y SphereSfM | Python empaquetado, COLMAP/SphereSfM, FFmpeg, CUDA runtime | Tool/lab | `colmap_sphere.exe`, `cudart64_12.dll`, `RC_Markers`, `360Gauss-LICENSE.txt` | Media | Alto | C/B: uso permitido, no codigo | Ejecutable Windows; no integrable | Referencia historica |
| `360Gaussian-1.2.0` | Build raiz con `360Gaussian.exe`, `updater.exe`, `RC_Markers`, `_internal` | Version estable inicial con updater y licencias | Python/PyInstaller, Flask/Dash/Plotly, Open3D, pycolmap, FFmpeg | Tool/lab | `version.json`, `batch_pipeline_config.ini`, `COLMAP-LICENSE.txt` | Media | Medio/alto | C: freeware restrictivo | Ejecutable, no SaaS | Documentar |
| `360Gaussian-1.3.0` | Build anidado; changelog incluye Sharp Frame Extractor, settings SphereSfM, LichtFeld auto settings, seam fix | Mejora pipeline de extraccion de frames y alineacion | Python empaquetado, SharpFrameExtractor, SphereSfM, LichtFeld integration | Tool/lab | `version.json`, `batch_pipeline_config.ini`, `SharpFrameExtractor-LICENSE.txt` | Alta como idea | Medio/alto | C/B | Ejecutable, no integrable | Adaptar idea de frame filtering |
| `360Gaussian-1.4.0` | Build raiz con GPS matching, video trim, loop detection, reuse frames/masks | Mejora batch processing, matching y reutilizacion | Python, COLMAP/SphereSfM, vocab trees, FFmpeg | Tool/lab | `version.json`, `vocab_trees`, `batch_pipeline_config.ini` | Alta para pipeline propio | Alto | C/B | Ejecutable, no integrable | Adaptar flujo |
| `360Gaussian-1.4.3` | Build raiz; custom masks, bug fixes, LichtFeld profiles, exports `.ply`, `.sog`, `.spz` | Amplia export y masking | Python empaquetado, LichtFeld, AutoMasker config | Tool/lab | `version.json`, `batch_pipeline_config.ini`, `cudart64_12.dll` | Alta para roadmap formats | Alto | C/B | Ejecutable, no integrable | Probar en lab si 1.4.4 falla |
| `360Gaussian-1.4.4` | Build raiz mas completo; 4.086 archivos, `360Gaussian.exe`, `updater.exe`, `_internal`, `RC_Markers`, licencias | Version recomendada para prueba controlada | Python 3.12 empaquetado, FFmpeg 7.1, SphereSfM/COLMAP, Qt5, Boost, pycolmap, Open3D, Plotly/Dash, OpenCV, CUDA runtime | Tool/lab/pipeline orchestrator | `version.json`, `batch_pipeline_config.ini`, `360Gauss-LICENSE.txt`, `colmap_sphere.exe`, `3DGS_ply.xml`, `3DGS_reg.xml` | Muy alta como referencia/lab, baja como codigo | Alto | C: no copiar/incluir producto | Ejecutable Windows; integracion directa no | Probar en lab, desarrollar propio |

## Archivos Clave Detectados

| Archivo | Funcion deducida | Relevancia |
|---|---|---|
| `360Gaussian.exe` | App principal Windows | No copiar; usar solo como herramienta si se acepta licencia |
| `updater.exe` | Actualizador | No usar en Immersphere |
| `_internal/version.json` | Version, changelog, URL, SHA/firma en 1.4.4 | Util para trazabilidad |
| `_internal/batch_pipeline_config.ini` | Config global de pipeline | Muy util como mapa conceptual |
| `_internal/bin/colmap_sphere.exe` | SphereSfM/COLMAP panoramico | Relevante para pipeline propio |
| `_internal/bin/ffmpeg.exe`, `ffprobe.exe` | Extraccion/conversion video | Reutilizar FFmpeg por separado, no desde paquete |
| `_internal/bin/RC_Settings/3DGS_ply.xml` | Export RealityCapture a sparse PLY | Referencia de formato |
| `_internal/bin/RC_Settings/3DGS_reg.xml` | Export parametros camera interno/externo | Referencia de registro |
| `RC_Markers/*.pdf` | Marcadores RC/AprilTags | Util para captura fisica, revisar uso/marca |
| `_internal/licenses/360Gauss-LICENSE.txt` | Licencia principal | Critica para clasificacion legal |

## Estructura Funcional Deducida

1. Entrada: video o imagenes 360/equirectangulares.
2. Extraccion de frames con FPS, resolucion, FOV, splits, tilt angles.
3. Filtrado: nitidez, best_n, thresholds, batch.
4. Preprocesado: cubemap, seam handling, masks, optional AutoMasker.
5. Alineacion: SphereSfM, COLMAP, RealityScan, Metashape.
6. Entrenamiento: Postshot, LichtFeld o Brush.
7. Export: PLY, SOG, SPZ, HTML segun herramienta.
8. Revision: posible Dash/Plotly/Open3D para feedback/visualizacion interna.

## Veredicto Por Carpeta

- Util: `360Gaussian-1.4.4`, `360Gaussian-1.4.3`, `360Gaussian-1.4.0`.
- Referencia historica: `V1.0`, `V1.1.1`, `1.2.0`, `1.3.0`.
- No hay carpeta que deba copiarse a Immersphere.
- La carpeta completa debe permanecer como material de lab/research.

