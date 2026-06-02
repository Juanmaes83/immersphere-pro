# Immersphere Pro - Copy / Adapt / Build Matrix

## Resumen ejecutivo

Esta matriz traduce la investigacion de Travvir, Travvir GitHub, panoocr, Matrix-3D y el mapa competitivo 360 en decisiones accionables para Immersphere Pro. La conclusion central es clara: casi nada propietario de Travvir se debe copiar; si aporta valor, debe tratarse como partnership/licencia o inspiracion de flujo. En cambio, panoocr, Matrix-3D y el repositorio de competidores tienen licencias MIT confirmadas y pueden alimentar laboratorio, prototipos y documentacion estrategica, siempre respetando avisos de copyright y dependencias de terceros.

## Que es

Una matriz operativa para decidir que copiar legalmente, que adaptar como idea, que construir internamente y que descartar.

## Valor para Immersphere Pro

- Evita riesgos legales al separar codigo permisivo de SDK propietario.
- Prioriza mejoras de producto: captura, metadata OCR, roadmap generativo, benchmark comercial.
- Convierte investigacion en backlog para SaaS, CRM, landing, catalogo y pitch.

## Matriz

| Fuente | Elemento detectado | Tipo | Licencia o estado legal | Copiable? | Adaptable? | Desarrollar nosotros? | Complejidad | Impacto | Riesgo | Prioridad | Accion recomendada |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Travvir web | Mensaje "Spatial AI" + captura con smartphone | Idea / modelo comercial | Propietario | No | Si | Si | Media | Alto | Bajo si no se copia texto/marca | Alta | Reposicionar Immersphere como sistema visual + captacion, no solo tour 360 |
| Travvir docs | SDK mobile Android/iOS para captura | SDK / API | Propietario; uso limitado; prohibe reverse engineering y derivados | No | Parcial | Si o partnership | Alta | Alto | Alto | Alta | Contactar para licencia; en paralelo definir capture app propia |
| Travvir docs | Flujo sessionId -> captura -> upload -> processing -> completed -> downloadUrl | Flujo / arquitectura | Documentacion propietaria; patron general no protegible | No codigo | Si | Si | Media | Alto | Medio | Alta | Adaptar como flujo interno de "capture job" con estados y metadata |
| Travvir docs | API server-side de estado de sesion | API pattern | Propietario | No | Si | Si | Media | Alto | Medio | Alta | Crear en roadmap endpoint interno `/capture-sessions/:id/status` |
| Travvir enterprise | Embed iframe responsive con analytics | UX / distribucion | Propietario | No | Si | Ya existe parcialmente | Baja | Alto | Bajo | Alta | Fortalecer iframe Immersphere con analytics, branding y permisos |
| Travvir enterprise | Verticales: hospitality, restaurants, fitness, real estate, retail, industrial, events | Segmentacion comercial | Publico/inspirable | No copiar copy | Si | Si | Baja | Alto | Bajo | Alta | Ampliar landing y CRM con verticales por industria |
| Travvir pricing | Pay-as-you-go por tamano de lugar + extras | Modelo comercial | Publico/inspirable | No copiar tabla literal | Si | Si | Media | Medio | Bajo | Media | Probar add-ons: extra tours, reels, Google Maps, white-label |
| Travvir partnership | Programa para fotografos/agencias | Modelo comercial | Publico/inspirable | No copiar texto | Si | Si | Media | Alto | Bajo | Alta | Crear "Immersphere Partner Studio" para captadores locales |
| Travvir GitHub | Travvir/panoocr fork de yz3440/panoocr | Codigo | MIT confirmado | Si, con aviso MIT | Si | Integrar piloto | Media | Alto | Medio por engines/API keys | Alta | Prototipo OCR metadata sobre panoramas 360 |
| Travvir GitHub | Travvir/Matrix-3D fork | Codigo / lab | MIT upstream | Si, con aviso MIT | Si | Lab | Alta | Medio/alto | Medio por GPU/modelos | Media | No produccion; demo Generative 3D Lab |
| Travvir GitHub | Travvir/360-thumbnail | Codigo | Sin LICENSE en raiz clonado | No hasta revisar | Si | Mejor construir propio | Baja | Medio | Medio | Media | Inspirarse en endpoint thumbnail; implementar propio con librerias licenciadas |
| Travvir GitHub | Travvir/segmentation_idm fork MaskDiffusion | Codigo investigacion | License raiz no clara; terceros MIT parciales | No | Si | Lab opcional | Alta | Medio | Alto | Baja | No integrar; estudiar semantic segmentation como concepto |
| panoocr | Perspectivas equirectangulares + deduplicacion | Codigo / algoritmo | MIT | Si | Si | Integrar wrapper | Media | Alto | Medio | Alta | PoC `tour metadata OCR`: carteles, marcas, habitaciones |
| panoocr | Motores EasyOCR/Paddle/RapidOCR/Florence/Gemini/Google Vision | Dependencias | Mixta; revisar cada engine y API | Parcial | Si | Seleccionar engines | Media/alta | Alto | Medio/alto | Alta | Empezar con RapidOCR local; evitar cloud hasta politica de datos |
| panoocr | Coordenadas yaw/pitch para texto detectado | API / data model | MIT | Si | Si | Si | Media | Alto | Bajo | Alta | Guardar annotations OCR como hotspots sugeridos |
| Matrix-3D | Text/image -> panorama -> video -> 3D scene .ply | Modelo / pipeline | MIT para repo; modelos HF y deps requieren revision | Si para lab | Si | No en core inmediato | Alta | Alto en demos | Medio/alto | Media | Laboratorio GPU cloud; demos de showroom y promociones sobre plano |
| Matrix-3D | Trayectorias custom para generacion de video panoramico | UX / pipeline | MIT | Si lab | Si | Si | Alta | Medio | Medio | Media | Probar trayectorias "walkthrough inmobiliario" para demos |
| Matrix-3D | Gradio demo | Demo | MIT | Si lab | Si | Si | Media | Medio | Bajo | Baja | Montar demo interna, no mostrar como producto estable |
| 360 software list | Lista de competidores y categorias | Documentacion / dataset manual | MIT | Si con atribucion | Si | Si | Baja | Alto | Bajo | Alta | Convertir en matriz competitiva del CRM y argumentario |
| 360 software list | Precios Matterport/Kuula/3DVista/etc. | Benchmark | MIT pero temporalmente variable | Si como referencia | Si | Mantener propio | Baja | Medio | Medio por obsolescencia | Media | Validar precios antes de usar comercialmente |
| Matterport | Digital twin lider y marca fuerte | Competidor | Propietario | No | Si | Diferenciar | Alta | Alto | Bajo | Alta | Competir con CRM/lead capture/white-label/local studio |
| Kuula/Theasys/CloudPano | Hosting/builder 360 sencillo | Competidor | Propietario | No | Si | Si | Media | Alto | Bajo | Alta | Posicionar Immersphere como ventas + analitica, no hosting generico |
| 3DVista/Krpano/Pano2VR | Control offline/pro dev | Competidor / herramienta | Propietario/licencias comerciales | No | Si | Integrar export propio | Media | Medio | Medio | Media | Mantener offline ZIP y visor propio como ventaja |

## Oportunidades

- Convertir "metadata visual automatica" en feature diferenciadora: OCR + hotspots sugeridos + buscador de tours.
- Crear un "Capture Pipeline" propio inspirado en Travvir sin copiar SDK.
- Usar Matrix-3D como escaparate premium de I+D para promotoras, showrooms y arquitectura conceptual.
- Convertir el mapa competitivo en argumentario de ventas y fichas de objeciones.

## Riesgos

- Travvir SDK es propietario: no copiar, no derivar, no reverse engineering.
- Licencias de modelos y dependencias de Matrix-3D y OCR deben revisarse una por una antes de produccion.
- Precios de competidores cambian; no usar como promesa comercial sin revalidar.
- `360-thumbnail` no tiene licencia clara en el clon: no reutilizar codigo.

## Prioridad

Alta para: panoocr PoC, benchmark competitivo, mejoras de iframe/analytics/CRM, roadmap capture sessions.
Media para: partnership Travvir, Matrix-3D lab.
Baja para: segmentation_idm y forks sin licencia clara.

## Proximos pasos

1. Crear ticket de PoC OCR: una imagen 360, RapidOCR local, JSON con texto/yaw/pitch/confidence.
2. Crear epic "Capture Sessions": estados, metadata, upload, processing, download, CRM link.
3. Crear fichas de competidores en CRM/catalogo: Matterport, CloudPano, Kuula, 3DVista, Krpano.
4. Contactar Travvir para condiciones SDK/iframe/white-label/territorio/uso en SaaS.
5. Montar Matrix-3D solo en GPU cloud para demo interna, con revision de licencias de modelos.

