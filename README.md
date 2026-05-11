# Immersphere Pro

Immersphere Pro es una plataforma SaaS premium multi-tenant para digitalización inmersiva de espacios. Esta entrega corresponde a la **Fase 4**: visor 360° real con Three.js + integración inicial de Gaussian Splatting con PlayCanvas + subida local de assets + editor básico no destructivo.

## Qué hace esta versión

- Renderiza un panorama 360° real con Three.js.
- Usa una textura equirectangular local en `client/public/demo/panorama-living-room.jpg`.
- Integra PlayCanvas `2.18.1` para cargar assets Gaussian Splat mediante componente `gsplat`.
- Añade `GaussianSplatRenderer`, motor PlayCanvas puro, separado de React.
- Añade `GaussianSplatViewer`, wrapper React con subida local de `.ply`, `.splat`, `.sog`, `.json` y `.glb`.
- Mantiene navegación WASD + ratón en visor Splat.
- Añade editor básico no destructivo: selección de zonas, clipping visual y contador de zonas ocultadas.
- Permite navegación por estancias usando `spaces` ordenados por `order`.
- Mantiene `dimensions` preparado para medición real futura.
- Muestra hotspots posicionados sobre el visor 360°.
- Registra eventos de analytics simulados para viewer, zoom, hotspots, uploads, splat ready/error y acciones de edición.
- Usa arquitectura separada: motores puros + wrappers React + visor universal.

## Tecnologías

- React 18
- TypeScript
- Three.js 0.170.0
- PlayCanvas 2.18.1
- Vite 5
- Tailwind CSS 3
- PostCSS
- Autoprefixer

## Estructura del proyecto

```text
immersphere-pro/
├── README.md
├── .gitignore
├── client/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── index.html
│   ├── .env.example
│   ├── .gitignore
│   ├── public/
│   │   └── demo/
│   │       ├── panorama-living-room.jpg
│   │       └── demo-gaussian-splat.ply
│   └── src/
│       ├── App.tsx
│       ├── index.css
│       ├── main.tsx
│       ├── components/
│       │   └── viewer/
│       │       ├── GaussianSplatViewer.tsx
│       │       ├── PanoramaViewer.tsx
│       │       └── UniversalViewer.tsx
│       ├── data/
│       │   └── demoProperties.ts
│       ├── engines/
│       │   ├── GaussianSplatRenderer.ts
│       │   └── PanoramaEngine360.ts
│       ├── pages/
│       │   └── PropertyDetailPage.tsx
│       └── types/
│           └── viewer.ts
└── server/
```

## Instalación

Desde la raíz del ZIP descomprimido:

```bash
cd immersphere-pro/client
npm install
npm run dev
```

Abrir en navegador:

```text
http://localhost:5173
```

## Build de producción

```bash
cd immersphere-pro/client
npm run build
```

## Prueba rápida de Fase 4

1. Abre el proyecto en local.
2. Entra en la ficha demo.
3. Cambia a la estancia `Showroom Splat`.
4. Comprueba que se intenta cargar el asset `demo-gaussian-splat.ply` con PlayCanvas.
5. Usa WASD y ratón dentro del visor.
6. Activa `Seleccionar gaussianas`.
7. Haz clic en la escena para crear zonas ocultadas.
8. Activa/desactiva `clipping`.
9. Sube un archivo `.ply`, `.splat` o `.sog` desde el panel.
10. Revisa el panel de eventos de analytics.

## Notas técnicas

- El motor Splat usa PlayCanvas instalado por npm. No usa CDN en runtime.
- El archivo `demo-gaussian-splat.ply` es un asset mínimo de demo. Para una demo comercial potente conviene sustituirlo por un `.sog` o `.ply` real exportado desde SuperSplat.
- El editor de Fase 4 es no destructivo: marca zonas ocultadas como overlay y registra eventos. La exportación destructiva del splat queda preparada para pipeline SuperSplat/SplatTransform.
- El bundle de producción puede mostrar aviso de tamaño por incluir Three.js + PlayCanvas. Es un warning no bloqueante.

## Subida a GitHub

```bash
cd immersphere-pro
git init
git add .
git commit -m "Fase 4: Gaussian Splatting PlayCanvas + editor básico"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/immersphere-pro.git
git push -u origin main
```

## Estado actual

Fase 4 completada.

La base ya tiene visor 360° real, integración inicial de Gaussian Splatting, carga local de assets y edición no destructiva básica.

## Próxima fase

Fase 5: SaaS producción: Stripe, analytics persistente, roles reales, backend, deploy y optimización de bundles.
