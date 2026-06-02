# PanoOCR 360 OCR Analysis

## Resumen ejecutivo

`Travvir/panoocr` es un fork publico de `yz3440/panoocr`, con licencia MIT confirmada en `LICENSE` y `pyproject.toml`. Es una de las fuentes mas accionables para Immersphere Pro porque resuelve un problema especifico de panoramas: convertir una imagen equirectangular en multiples perspectivas, aplicar OCR y devolver resultados con coordenadas esfericas yaw/pitch. La recomendacion es llevarlo a laboratorio de producto como modulo de metadata automatica para tours 360, empezando con motores locales y evitando APIs cloud hasta definir privacidad y costes.

## Que es

Biblioteca Python para OCR sobre panoramas equirectangulares. Soporta motores OCR multiples, proyeccion perspectiva automatica, deduplicacion y coordenadas esfericas para mapear texto detectado al panorama.

Fuente inspeccionada:
- Repo clonado superficialmente: `https://github.com/Travvir/panoocr`
- README, LICENSE y `pyproject.toml`
- Fork declarado desde `yz3440/panoocr`
- Ultimo commit inspeccionado: `fb51518`, 2026-03-31

## Valor para Immersphere Pro

- Detectar carteles, nombres de espacios, marcas, menus, placas, referencias y textos visibles dentro de tours.
- Generar metadata semantica para buscador interno y para Vera.
- Sugerir hotspots automaticos: "cartel detectado", "zona de acceso", "marca de cocina", "numero de habitacion".
- Mejorar accesibilidad: texto detectado disponible fuera de la imagen.
- Enriquecer analitica: que elementos/textos aparecen en las estancias mas vistas.

## Oportunidades

| Oportunidad | Producto | Impacto | Prioridad |
|---|---|---:|---|
| OCR de panoramas al subir asset 360 | SaaS | Alto | Alta |
| Hotspots sugeridos con texto/yaw/pitch | Editor tours | Alto | Alta |
| Buscador de tours por texto visible | SaaS/CRM | Medio/alto | Media |
| "Vera conoce lo que se ve en la estancia" | Asistente IA | Alto | Alta |
| Auditoria de espacios comerciales: senaletica y marcas | Vertical retail/hoteles | Medio | Media |
| Accesibilidad textual de tours | SaaS/landing | Medio | Media |

## Riesgos

- Aunque PanoOCR es MIT, los motores OCR opcionales tienen licencias y requisitos distintos.
- Motores cloud como Google Vision o Gemini implican coste, datos personales y politicas de privacidad.
- Florence/torch/Paddle/EasyOCR pueden ser pesados para un backend SaaS general.
- El paquete requiere Python 3.11+, mientras Immersphere Pro es Node/Express; habria que integrarlo como worker Python o microservicio.
- OCR de escenas reales puede generar falsos positivos; debe mostrarse como sugerencia revisable.

## Licencia

MIT confirmada. Se puede copiar/reutilizar codigo con atribucion y conservando copyright/licencia. No obstante, cada dependencia opcional debe revisarse antes de produccion.

## Que podemos copiar

- Codigo MIT de pipeline OCR si se conserva aviso de licencia.
- Modelo de datos de resultados: texto, confianza, yaw/pitch, bounding boxes.
- Utilidades de proyeccion/deduplicacion si encajan tecnicamente.

## Que podemos adaptar

- Flujo "subir panorama -> generar perspectivas -> detectar texto -> deduplicar -> mapear a yaw/pitch".
- Preview interactiva de detecciones sobre panorama.
- Seleccion de motores por entorno: local rapido, GPU premium, cloud enterprise.

## Que debemos desarrollar nosotros

- Integracion con assets de Immersphere, Cloudinary y base de datos.
- UI de aprobacion/rechazo de detecciones.
- Politicas de privacidad y consentimiento para OCR.
- Worker asincrono y cola de procesamiento.
- Reglas de conversion de detecciones a hotspots o tags comerciales.

## Que no debemos usar

- Motores cloud sin contrato, DPA o politica de datos.
- Resultado OCR como verdad automatica sin revision humana.
- Dependencias GPU pesadas en produccion general sin coste controlado.

## Prioridad

Alta para PoC. Media para produccion, condicionada a rendimiento y privacidad.

## Proximos pasos

1. PoC con una panoramica de demo y RapidOCR local.
2. Guardar JSON: `assetId`, `text`, `confidence`, `yaw`, `pitch`, `engine`, `createdAt`.
3. Mostrar detecciones como "hotspots sugeridos" en editor.
4. Conectar Vera a metadata OCR aprobada.
5. Medir coste/tiempo por panorama antes de ponerlo en plan Pro/Agency.

