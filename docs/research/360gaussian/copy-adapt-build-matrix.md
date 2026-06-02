# 360Gaussian Copy / Adapt / Build Matrix

## Resumen Ejecutivo

El producto 360Gaussian no es copiable como codigo ni integrable dentro del SaaS; los outputs creados con el software si pueden aprovecharse; las ideas de pipeline son adaptables; los componentes open source deben evaluarse e integrarse por separado si se necesitan.

## Matriz

| Carpeta / modulo | Tipo de activo | Que hace | Tecnologia | Licencia | Copiable? | Adaptable? | Integrable? | Desarrollar nosotros? | Complejidad | Coste estimado | Riesgo legal | Riesgo tecnico | Impacto comercial | Prioridad | Accion recomendada |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 360Gaussian app | Ejecutable/producto | Orquesta pipeline 360 -> SfM -> GS | EXE Windows/Python empaquetado | Freeware restrictivo | No | Si | No dentro del SaaS | Si, pipeline propio | Alta | Medio/alto | Alto si se copia/integra | Medio/alto | Alto | Alta | PROBAR EN LAB |
| Outputs generados | Assets | Splats/PLY derivados | PLY/SOG/SPZ/HTML segun tool | Permitido por licencia 360Gauss | Si, como assets | Si | Si | No aplica | Media | Bajo/medio | Bajo | Medio | Alto | Alta | IMPLEMENTAR AHORA como assets manuales |
| `batch_pipeline_config.ini` | Arquitectura/config | Define etapas y parametros | INI | Parte del producto; usar como referencia | No copiar literal en producto | Si | No directo | Si | Media | Bajo | Medio | Medio | Alto | Alta | ADAPTAR COMO IDEA |
| FFmpeg | Binario/dependencia | Extrae frames, probe video | FFmpeg LGPL v3 build | LGPL | Si por separado cumpliendo LGPL | Si | Si, como dependencia externa | No | Media | Bajo | Medio | Bajo/medio | Alto | Alta | DESARROLLAR/INTEGRAR POR SEPARADO |
| SphereSfM/COLMAP | Binario SfM | Alineacion panoramica/SfM | C++/COLMAP | BSD 3-Clause | Si por separado | Si | Si, con review | Parcial | Alta | Medio | Bajo/medio | Alto | Alto | Alta | PROBAR EN LAB |
| pycolmap | Python bindings | SfM bindings | Python/C++ | BSD 3-Clause | Si por separado | Si | Si en worker | Parcial | Alta | Medio | Bajo | Alto | Alto | Media | PROBAR EN LAB |
| RealityScan/RealityCapture config | Config export | Export PLY/registration | XML | Tool externo propietario | No como dependencia sin licencia | Si | Solo con licencia Epic/RC | Si alternativas | Media | Medio | Medio/alto | Medio | Medio | Media | DOCUMENTAR/REVISAR |
| LichtFeld settings | Config training/export | Entrena/exporta PLY/SOG/SPZ/HTML | LichtFeld Studio | Licencia externa a revisar | No directo | Si | Solo con licencia compatible | Alternativa propia | Alta | Medio/alto | Medio | Alto | Alto | Media | PROBAR EN LAB |
| Brush settings | Config training | Entrena Gaussian via Brush | Brush app externa | A revisar | No directo | Si | Solo si licencia permite | Alternativa | Alta | Medio | Medio | Alto | Medio | Baja/media | DOCUMENTAR |
| AutoMasker settings | Modulo externo | Mascara personas/objetos | GroundingDINO/SAM config | Modelos externos a revisar | No | Si | Solo como lab | Si | Alta | Medio/alto | Alto | Alto | Medio/alto | Media | PROBAR EN LAB |
| Sharp frame extractor | Algoritmo/concepto | Filtra frames nitidos | Tenengrad/sharpness | MIT para SharpFrameExtractor | Si por separado | Si | Si | Si | Baja/media | Bajo | Bajo | Bajo | Alto | Alta | IMPLEMENTAR AHORA como idea |
| RC/AprilTags markers | Assets PDF | Marcadores para escala/alineacion | PDF markers | A revisar marcas/uso | No asumir | Si | No SaaS | Crear propios | Baja | Bajo | Medio | Bajo | Medio | Media | ADAPTAR COMO IDEA |
| Dash/Plotly/Flask | Dependencias UI/backend | Posible UI local/reporting | Python web | MIT/BSD | Si por separado | Si | No necesario en React SaaS | No | Media | Bajo | Bajo | Medio | Bajo | Baja | DOCUMENTAR |
| Open3D | Dependencia 3D | Visualizacion/procesado point cloud | Python/C++ | MIT | Si por separado | Si | Worker/lab | Parcial | Media | Bajo/medio | Bajo | Medio | Medio | Media | PROBAR EN LAB |
| `updater.exe` | Ejecutable | Actualizaciones | Propietario | Freeware restrictivo | No | No | No | No | Baja | N/A | Alto | Medio | Nulo | Baja | DESCARTAR |
| Versiones antiguas | Builds historicos | Evolucion del producto | EXE Windows | Mixto/freeware | No | Si | No | Si | Media | N/A | Medio/alto | Medio | Bajo | Baja | DOCUMENTAR COMO REFERENCIA |

## Decisiones

- Copiar: solo outputs generados y componentes open source por separado, nunca el producto modificado o embebido.
- Adaptar: pipeline por etapas, frame filtering, batch/reuse frames, multi-export, marcadores/escala.
- Desarrollar: Immersphere Capture job model, worker de frames, integracion legal con COLMAP/SphereSfM/pycolmap, storage de PLY/SPZ/SOG, viewer web y conector CRM.
- Probar: 1.4.4 con video 360 propio, export PLY, compatibilidad con viewer.
- Descartar: integrar `360Gaussian.exe`, reempaquetar/revender, usar updater, reverse engineering.

