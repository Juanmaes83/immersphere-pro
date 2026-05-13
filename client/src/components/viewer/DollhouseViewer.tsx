import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Hotspot, Space } from '@/types/viewer';

interface DollhouseViewerProps {
  spaces: Space[];
  primaryColor?: string;
  activeSpaceId: string;
  onSpaceClick: (spaceId: string) => void;
}

const DEFAULT_W = 4;
const DEFAULT_H = 2.5;
const DEFAULT_D = 4;
const GAP = 0.6;
const COLS = 3;

const ASSET_COLORS: Record<string, string> = {
  panorama_360: '#7C3AED',
  gaussian_splat: '#06B6D4',
  mesh: '#F59E0B'
};
const FALLBACK_COLOR = '#475569';

function roomColor(space: Space): string {
  const type = space.assets[0]?.type;
  return type ? (ASSET_COLORS[type] ?? FALLBACK_COLOR) : FALLBACK_COLOR;
}

function roomDims(space: Space): [number, number, number] {
  const d = space.dimensions;
  return [d.width ?? DEFAULT_W, d.height ?? DEFAULT_H, d.depth ?? DEFAULT_D];
}

function roomPosition(index: number, w: number, d: number): [number, number, number] {
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  return [col * (w + GAP), 0, row * (d + GAP)];
}

function hotspotDotsForSpace(hotspots: Hotspot[]): Hotspot[] {
  return hotspots.slice(0, 3);
}

function dotColor(type: Hotspot['type']): string {
  if (type === 'cta') return '#22C55E';
  if (type === 'navigation') return '#F59E0B';
  if (type === 'measurement') return '#38BDF8';
  return '#E2E8F0';
}

export default function DollhouseViewer({
  spaces,
  primaryColor = '#7C3AED',
  activeSpaceId,
  onSpaceClick
}: DollhouseViewerProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const frameRef = useRef<number>(0);
  const meshMapRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const hoveredRef = useRef<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0f172a');
    sceneRef.current = scene;

    const w = container.clientWidth || 800;
    const h = container.clientHeight || 500;

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 3;
    controls.maxDistance = 40;
    controls.maxPolarAngle = Math.PI / 2.1;

    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(8, 14, 6);
    scene.add(dirLight);

    const grid = new THREE.GridHelper(60, 60, 0x1e293b, 0x1e293b);
    grid.position.y = -0.02;
    scene.add(grid);

    const meshMap = new Map<string, THREE.Mesh>();
    meshMapRef.current = meshMap;

    let centerX = 0;
    let centerZ = 0;

    spaces.forEach((space, i) => {
      const [rw, rh, rd] = roomDims(space);
      const [px, , pz] = roomPosition(i, rw, rd);

      const isActive = space.id === activeSpaceId;
      const color = isActive ? primaryColor : roomColor(space);

      const boxGeo = new THREE.BoxGeometry(rw, rh, rd);
      const boxMat = new THREE.MeshStandardMaterial({
        color,
        transparent: true,
        opacity: isActive ? 0.55 : 0.38,
        roughness: 0.7,
        metalness: 0.1
      });
      const box = new THREE.Mesh(boxGeo, boxMat);
      box.position.set(px + rw / 2, rh / 2, pz + rd / 2);
      box.userData['spaceId'] = space.id;
      scene.add(box);
      meshMap.set(space.id, box);

      const edgesGeo = new THREE.EdgesGeometry(boxGeo);
      const edgesMat = new THREE.LineBasicMaterial({
        color: isActive ? primaryColor : '#94a3b8',
        linewidth: isActive ? 2 : 1
      });
      const edges = new THREE.LineSegments(edgesGeo, edgesMat);
      box.add(edges);

      const visibleHotspots = hotspotDotsForSpace(
        space.assets.flatMap((a) => a.hotspots ?? [])
      );
      visibleHotspots.forEach((hs, hi) => {
        const dotGeo = new THREE.SphereGeometry(0.09, 8, 8);
        const dotMat = new THREE.MeshStandardMaterial({
          color: dotColor(hs.type),
          emissive: dotColor(hs.type),
          emissiveIntensity: 0.6
        });
        const dot = new THREE.Mesh(dotGeo, dotMat);
        const offsetX = (hi - 1) * 0.35;
        dot.position.set(offsetX, rh / 2 + 0.22, 0);
        dot.userData['spaceId'] = space.id;
        box.add(dot);
      });

      centerX += px + rw / 2;
      centerZ += pz + rd / 2;
    });

    if (spaces.length > 0) {
      centerX /= spaces.length;
      centerZ /= spaces.length;
    }

    camera.position.set(centerX + 10, 12, centerZ + 10);
    controls.target.set(centerX, 0, centerZ);
    controls.update();

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    function getSpaceIdAtEvent(event: MouseEvent): string | null {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -(((event.clientY - rect.top) / rect.height) * 2 - 1)
      );
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(scene.children, true);
      for (const hit of hits) {
        const id = hit.object.userData['spaceId'] as string | undefined;
        if (id) return id;
      }
      return null;
    }

    function onPointerMove(event: MouseEvent): void {
      const id = getSpaceIdAtEvent(event);
      if (id === hoveredRef.current) return;

      if (hoveredRef.current) {
        const prevMesh = meshMap.get(hoveredRef.current);
        if (prevMesh) {
          (prevMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
        }
      }

      hoveredRef.current = id;
      if (id) {
        const mesh = meshMap.get(id);
        if (mesh) {
          (mesh.material as THREE.MeshStandardMaterial).emissive = new THREE.Color('#ffffff');
          (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.06;
          renderer.domElement.style.cursor = 'pointer';
        }
      } else {
        renderer.domElement.style.cursor = 'grab';
      }
    }

    function onPointerDown(event: MouseEvent): void {
      const id = getSpaceIdAtEvent(event);
      if (id) onSpaceClick(id);
    }

    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);

    function onResize(): void {
      if (!containerRef.current) return;
      const nw = containerRef.current.clientWidth;
      const nh = containerRef.current.clientHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    }
    window.addEventListener('resize', onResize);

    function animate(): void {
      frameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      sceneRef.current = null;
      rendererRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaces, primaryColor]);

  useEffect(() => {
    const meshMap = meshMapRef.current;
    meshMap.forEach((mesh, id) => {
      const isActive = id === activeSpaceId;
      const space = spaces.find((s) => s.id === id);
      const color = isActive ? primaryColor : (space ? roomColor(space) : FALLBACK_COLOR);
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.color.set(color);
      mat.opacity = isActive ? 0.55 : 0.38;
      const edges = mesh.children.find((c) => c instanceof THREE.LineSegments) as THREE.LineSegments | undefined;
      if (edges) {
        (edges.material as THREE.LineBasicMaterial).color.set(isActive ? primaryColor : '#94a3b8');
      }
    });
  }, [activeSpaceId, primaryColor, spaces]);

  const hasDimensions = spaces.some(
    (s) => s.dimensions.width !== null || s.dimensions.depth !== null
  );

  return (
    <div className="relative overflow-hidden rounded-[1.5rem] bg-slate-950">
      <div ref={containerRef} className="min-h-[520px] w-full" />

      <div className="absolute left-5 top-5 z-10 rounded-2xl border border-white/10 bg-black/55 px-4 py-3 text-white backdrop-blur">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-fuchsia-200">
          Vista Dollhouse · Fase 1
        </p>
        <p className="mt-1 text-sm font-bold">Haz clic en una estancia para entrar</p>
        {!hasDimensions ? (
          <p className="mt-2 text-xs text-amber-300/80">
            * Dimensiones estimadas ({DEFAULT_W}m × {DEFAULT_W}m × {DEFAULT_H}m)
          </p>
        ) : (
          <p className="mt-2 text-xs text-white/45">Arrastra para orbitar · Scroll para zoom</p>
        )}
      </div>

      <div className="absolute bottom-5 right-5 z-10 flex flex-col gap-1.5 rounded-2xl border border-white/10 bg-black/55 p-3 text-xs text-white/70 backdrop-blur">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: primaryColor }} />
          Estancia activa
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-violet-500" />
          Panorama 360°
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-cyan-500" />
          Gaussian Splat
        </span>
        <span className="mt-1 border-t border-white/10 pt-1 font-black uppercase tracking-wider text-white/40">
          Hotspots
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-green-400" /> CTA
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-400" /> Navegación
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-sky-400" /> Medición
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-slate-300" /> Info
        </span>
      </div>
    </div>
  );
}
