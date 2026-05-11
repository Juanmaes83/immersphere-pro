import type { Space } from '@/types/viewer';

export interface DemoProperty {
  id: string;
  title: string;
  location: string;
  type: string;
  price: number;
  area: number;
  rooms: number;
  bathrooms: number;
  description: string;
  leadScore: number;
  visits: number;
  leads: number;
  spaces: Space[];
}

export const demoSpaces: Space[] = [
  {
    id: 'living-room',
    name: 'Salón',
    order: 1,
    dimensions: {
      width: null,
      height: null,
      depth: null
    },
    assets: [
      {
        id: 'living-room-panorama',
        type: 'panorama_360',
        url: '/demo/panorama-living-room.jpg',
        thumbnail: '/demo/panorama-living-room.jpg',
        format: 'jpg',
        size: 72,
        hotspots: [
          {
            id: 'living-terrace',
            label: 'Terraza conectada al salón',
            type: 'info',
            position: {
              x: 72,
              y: 43
            },
            body: 'Zona de alto interés comercial. Ideal para destacar orientación, luz natural y amplitud.',
            metric: '18 m² aprox.'
          },
          {
            id: 'living-contact',
            label: 'Contactar agente',
            type: 'cta',
            position: {
              x: 52,
              y: 62
            },
            body: 'CTA contextual dentro de la estancia más vista. En producción genera lead con contexto.',
            metric: 'Lead caliente'
          }
        ]
      }
    ]
  },
  {
    id: 'kitchen',
    name: 'Cocina',
    order: 2,
    dimensions: {
      width: null,
      height: null,
      depth: null
    },
    assets: [
      {
        id: 'kitchen-panorama',
        type: 'panorama_360',
        url: '/demo/panorama-living-room.jpg',
        thumbnail: '/demo/panorama-living-room.jpg',
        format: 'jpg',
        size: 64,
        hotspots: [
          {
            id: 'kitchen-materials',
            label: 'Acabados y materiales',
            type: 'info',
            position: {
              x: 46,
              y: 48
            },
            body: 'Hotspot para mostrar encimera, electrodomésticos, ventilación y calidades.',
            metric: 'Calidad premium'
          },
          {
            id: 'kitchen-measurement',
            label: 'Superficie estimada',
            type: 'measurement',
            position: {
              x: 66,
              y: 66
            },
            body: 'Dato informativo. La medición real llegará en fases posteriores con calibración.',
            metric: '14 m² aprox.'
          }
        ]
      }
    ]
  },
  {
    id: 'splat-preview',
    name: 'Showroom Splat',
    order: 3,
    dimensions: {
      width: null,
      height: null,
      depth: null
    },
    assets: [
      {
        id: 'showroom-splat-placeholder',
        type: 'gaussian_splat',
        url: '/demo/demo-gaussian-splat.ply',
        thumbnail: '/demo/panorama-living-room.jpg',
        format: 'ply',
        size: 420,
        hotspots: []
      }
    ]
  }
];

export const demoProperty: DemoProperty = {
  id: 'prop-001',
  title: 'Ático Mediterráneo 360',
  location: 'Alicante Centro',
  type: 'Ático',
  price: 485000,
  area: 142,
  rooms: 3,
  bathrooms: 2,
  description:
    'Propiedad premium preparada para visita virtual con hotspots comerciales, medición de estancias y captación de lead cualificado. La Fase 4 añade integración PlayCanvas para Gaussian Splats, subida local de assets y editor básico no destructivo.',
  leadScore: 86,
  visits: 214,
  leads: 17,
  spaces: demoSpaces
};
