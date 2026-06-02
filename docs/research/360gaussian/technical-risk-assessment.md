# 360Gaussian Technical Risk Assessment

## Resumen Ejecutivo

360Gaussian es valioso como herramienta de laboratorio, pero introduce riesgos significativos si se intenta convertir en parte del producto SaaS. Es Windows-only, pesado, dependiente de GPU/herramientas externas, con licencia restrictiva y multiples librerias nativas. La recomendacion tecnica es aislarlo: usarlo manualmente para aprender/producir assets, no desplegarlo en Vercel/Railway ni automatizarlo dentro del backend principal.

## GPU

Riesgo: alto.

Evidencias:
- `cudart64_12.dll` incluido.
- Config `usegpu = True`, `gpuindex = 0`, `gpu_splitting_enabled`, `gpu_resource_mode`.
- COLMAP/SphereSfM y entrenamiento GS suelen beneficiarse de CUDA.
- AutoMasker apunta a GroundingDINO/SAM, modelos pesados.

Mitigacion:
- Pruebas en workstation o GPU cloud, nunca en backend SaaS general.
- Definir modo CPU solo para extraccion/preparacion.
- Medir VRAM y tiempo por proyecto.

## Dependencias

Riesgo: alto.

Dependencias detectadas:
- FFmpeg, FFprobe.
- SphereSfM/COLMAP, pycolmap.
- Qt5, Boost, Ceres, OpenEXR, FreeImage, OpenCV.
- Python 3.12 empaquetado, NumPy, SciPy, Open3D, Plotly, Dash, Flask.
- Potenciales herramientas externas: RealityScan, Jawset Postshot, AutoMasker, COLMAP externo, Brush, LichtFeld Studio, Metashape.

Mitigacion:
- No intentar portar el paquete completo.
- Elegir dependencias por separado con licencias claras.
- Worker aislado por job, no proceso monolitico.

## Seguridad

Riesgo: medio/alto.

- Ejecutables descargados en Downloads, aunque 1.4.4 incluye SHA256/firma en `version.json`.
- `updater.exe` y URLs externas de descarga.
- Rutas hardcodeadas a herramientas externas en `batch_pipeline_config.ini`.
- Procesamiento de archivos de usuario puede traer inputs maliciosos.

Mitigacion:
- No ejecutar updater en entorno de producto.
- Verificar hashes antes de lab.
- Procesar media en sandbox.
- No aceptar archivos arbitrarios sin validacion.

## Mantenimiento

Riesgo: alto.

- Producto freeware externo.
- Codigo fuente no disponible en paquete.
- Cambios entre versiones dependen del autor.
- Si falla, Immersphere no puede corregir internamente.

Mitigacion:
- Tratar como tool externo.
- Crear pipeline propio para produccion.
- Mantener version auditada congelada para lab.

## Rendimiento Movil

Riesgo: alto si se confunde output con experiencia final.

- 360Gaussian procesa en escritorio; no es viewer movil.
- Outputs PLY/SPZ/SOG pueden ser pesados.
- Immersphere debe optimizar visor, LOD, compresion y fallback.

Mitigacion:
- Evaluar outputs en dispositivos reales.
- Limitar numero de splats o usar formatos comprimidos.
- Crear fallback panorama 360 para movil.

## Compatibilidad Web Y Hosting

Riesgo: medio/alto.

- No se detecta viewer web propio reutilizable.
- Export HTML depende de LichtFeld config y herramienta externa.
- Vercel/GitHub Pages pueden alojar outputs estaticos, pero no procesar pipelines.
- Procesamiento no viable en Vercel ni Railway general.

Mitigacion:
- Usar Immersphere viewer existente o Spark/LichtFeld compatible.
- Separar processing offline de hosting web.
- Worker GPU separado y storage por asset con CDN.

## Formatos

Riesgo: medio.

Formatos deducidos:
- Entrada: video, frames, equirectangular/cubemap.
- Salida: PLY; potencialmente SOG, SPZ, HTML via LichtFeld.
- Config RC: sparse point cloud PLY y parametros camera.

Mitigacion:
- Definir formatos soportados por Immersphere: `.ply`, `.splat`, `.spz`, `.glb`, panorama.
- Crear conversores solo con herramientas licenciadas.

## Licencias

Riesgo: alto para integracion directa.

La licencia 360Gauss permite uso y derivados, pero prohibe modificar, decompilar, reverse engineering, vender el software o incluirlo en un producto comercial. Terceros tienen licencias varias: LGPL, BSD, MIT, Apache, FIPL, CDDL/LGPL.

Mitigacion:
- No integrar 360Gaussian como componente SaaS.
- Reutilizar solo componentes open source por separado.
- Revision legal antes de redistribuir nada.

## Veredicto De Riesgo

- Produccion SaaS directa: no recomendado.
- Lab controlado: recomendado.
- Referencia de arquitectura: muy recomendado.
- Pipeline propio: recomendado a medio plazo.

