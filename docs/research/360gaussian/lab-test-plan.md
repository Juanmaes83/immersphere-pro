# 360Gaussian Lab Test Plan

## Resumen Ejecutivo

Este plan define como probar 360Gaussian-1.4.4 sin instalar dependencias nuevas ni integrarlo en Immersphere. Los comandos son sugeridos para una futura fase de laboratorio; no se han ejecutado durante esta auditoria. El objetivo es validar si los outputs generados pueden alimentar Immersphere Viewer, landing y CRM.

## Que Probar Primero

1. Verificar hash del ZIP 1.4.4 contra `version.json`.
2. Ejecutar 360Gaussian en equipo Windows aislado.
3. Procesar un video 360 corto propio, no material de cliente.
4. Exportar PLY.
5. Si hay licencias/herramientas disponibles, probar Postshot/LichtFeld/Brush.
6. Probar output en viewer Immersphere o viewer externo controlado.
7. Medir tiempo, tamano, calidad y rendimiento movil.

## Entorno Necesario

| Elemento | Requisito |
|---|---|
| OS | Windows 10/11 |
| GPU | NVIDIA recomendada; CUDA por `cudart64_12.dll` |
| RAM | 32 GB recomendado |
| Disco | 20-50 GB libres para temporales |
| Herramientas opcionales | RealityScan/RealityCapture, Jawset Postshot, LichtFeld Studio, Brush, Metashape, AutoMasker |
| Material | Video 360 corto o panoramas propios |
| Red | Desactivable salvo actualizaciones; no ejecutar updater sin decidir |

## Comandos Sugeridos No Ejecutados

Verificacion hash:

```powershell
Get-FileHash -Algorithm SHA256 "C:\Users\temp123\Downloads\360Gaussian-1.4.4\360Gaussian-1.4.4.zip"
```

Inventario de salida despues de una prueba:

```powershell
Get-ChildItem -Recurse "RUTA_DE_OUTPUT" | Group-Object Extension | Sort-Object Count -Descending
```

Localizar PLY/SPZ/SOG generados:

```powershell
Get-ChildItem -Recurse "RUTA_DE_OUTPUT" -Include *.ply,*.spz,*.sog,*.html
```

No ejecutar en esta fase:

```powershell
.\360Gaussian.exe
.\updater.exe
```

## Dependencias A Revisar Antes De Prueba

- 360Gauss freeware license.
- FFmpeg LGPL.
- SphereSfM/COLMAP BSD.
- RealityScan/RealityCapture licencia comercial/Epic.
- Postshot licencia Jawset.
- LichtFeld Studio licencia.
- Brush licencia.
- AutoMasker, GroundingDINO y SAM/SAM2 licencias/modelos.

## Criterios De Exito

| Criterio | Objetivo |
|---|---|
| Arranque | 360Gaussian abre sin errores en equipo aislado |
| Procesamiento | Genera frames/alineacion sin crash |
| Export | Produce PLY o formato compatible |
| Calidad visual | Resultado vendible en demo premium |
| Rendimiento | Asset cargable en viewer web o convertible |
| Mobile | Existe fallback si no rinde en movil |
| Legal | No se copia/modifica software; solo se usan outputs |
| CRM | Output puede asociarse a propiedad/lead/propuesta |

## Tiempo Estimado

- Preparacion entorno: 1-2 h.
- Prueba video corto: 1-4 h segun GPU y herramientas.
- QA viewer: 1-2 h.
- Documentacion de resultados: 1 h.

## Riesgos

- Ejecutable no arranca por dependencias Windows/GPU.
- Rutas por defecto apuntan a discos `E:/` del autor; habra que configurarlas manualmente.
- Herramientas externas no instaladas o sin licencia.
- Output demasiado pesado para web.
- Calidad insuficiente en espacios con poca textura, reflejos o movimiento.
- Licencia impide integracion directa.

## Salida Esperada

- Carpeta de output con frames extraidos.
- Datos de alineacion/SfM.
- PLY y, si procede, SOG/SPZ/HTML.
- Registro de parametros usados.
- Capturas/video QA del resultado.
- Decision: descartar, repetir con mejor captura o integrar asset en demo Immersphere.

## Plan De Decision

| Resultado | Decision |
|---|---|
| Output bueno y web-compatible | Convertir en demo comercial Lab |
| Output bueno pero pesado | Optimizar/conversor/fallback |
| Output pobre | Mejorar captura o descartar caso |
| Pipeline demasiado fragil | Solo referencia, no servicio |
| Problema legal | No usar en cliente; desarrollar alternativa |

