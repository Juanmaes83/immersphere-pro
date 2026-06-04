import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';

interface Native3dPosition {
  mode?: string;
  x?: number;
  y?: number;
  z?: number;
  normal?: { x: number; y: number; z: number };
  camera?: {
    position?: [number, number, number];
    target?: [number, number, number];
  };
}

interface NativePointCloudHotspot {
  id: string;
  label: string;
  position: Record<string, unknown> | Native3dPosition | null;
}

export interface NativePointPickData {
  mode: 'native_3d';
  x: number;
  y: number;
  z: number;
  normal?: { x: number; y: number; z: number };
  camera: {
    position: [number, number, number];
    target: [number, number, number];
  };
}

interface NativePointCloudViewerProps {
  assetUrl: string;
  hotspots: NativePointCloudHotspot[];
  activeHotspotId: string | null;
  onHotspotClick: (hotspotId: string) => void;
  mode?: 'view' | 'edit';
  onPickPoint?: (pointData: NativePointPickData) => void;
  className?: string;
}

function isNative3dPosition(value: NativePointCloudHotspot['position']): value is Native3dPosition {
  return Boolean(
    value &&
    typeof value === 'object' &&
    (value as Native3dPosition).mode === 'native_3d' &&
    typeof (value as Native3dPosition).x === 'number' &&
    typeof (value as Native3dPosition).y === 'number' &&
    typeof (value as Native3dPosition).z === 'number'
  );
}

function toTuple(vector: THREE.Vector3): [number, number, number] {
  return [
    Number(vector.x.toFixed(4)),
    Number(vector.y.toFixed(4)),
    Number(vector.z.toFixed(4))
  ];
}

export default function NativePointCloudViewer({
  assetUrl,
  hotspots,
  activeHotspotId,
  onHotspotClick,
  mode = 'view',
  onPickPoint,
  className = ''
}: NativePointCloudViewerProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cloudRef = useRef<THREE.Points | null>(null);
  const frameRef = useRef<number>(0);
  const initialViewRef = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [projectedHotspots, setProjectedHotspots] = useState<Array<{ id: string; label: string; left: number; top: number; visible: boolean }>>([]);

  const nativeHotspots = useMemo(() => hotspots.filter((hotspot) => isNative3dPosition(hotspot.position)), [hotspots]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const containerElement = container;

    let disposed = false;
    setStatus('loading');
    setErrorMessage('');
    setProjectedHotspots([]);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x030408);
    sceneRef.current = scene;

    const width = containerElement.clientWidth || 800;
    const height = containerElement.clientHeight || 520;
    const camera = new THREE.PerspectiveCamera(55, width / height, 0.01, 2000);
    camera.position.set(0, 1.6, 4);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.domElement.className = 'h-full w-full';
    containerElement.innerHTML = '';
    containerElement.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.05;
    controls.maxDistance = 500;
    controlsRef.current = controls;

    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const light = new THREE.DirectionalLight(0xffffff, 0.6);
    light.position.set(3, 6, 4);
    scene.add(light);

    function fitGeometry(geometry: THREE.BufferGeometry): void {
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      const box = geometry.boundingBox;
      const sphere = geometry.boundingSphere;
      if (!box || !sphere) return;
      const center = sphere.center.clone();
      const radius = Math.max(sphere.radius, 0.1);
      const distance = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2));
      camera.position.copy(center.clone().add(new THREE.Vector3(distance * 0.35, distance * 0.25, distance)));
      controls.target.copy(center);
      controls.update();
      initialViewRef.current = { position: camera.position.clone(), target: center.clone() };
    }

    const loader = new PLYLoader();
    loader.load(
      assetUrl,
      (geometry) => {
        if (disposed) {
          geometry.dispose();
          return;
        }
        geometry.computeVertexNormals();
        const hasColor = Boolean(geometry.getAttribute('color'));
        const material = new THREE.PointsMaterial({
          size: 0.018,
          sizeAttenuation: true,
          vertexColors: hasColor,
          color: hasColor ? 0xffffff : 0xc4b5fd
        });
        const points = new THREE.Points(geometry, material);
        points.name = 'native-point-cloud';
        scene.add(points);
        cloudRef.current = points;
        fitGeometry(geometry);
        setStatus('ready');
      },
      undefined,
      () => {
        if (disposed) return;
        setStatus('error');
        setErrorMessage('No se pudo cargar el viewer propio. Usa el viewer externo o revisa el formato del asset.');
      }
    );

    const raycaster = new THREE.Raycaster();
    raycaster.params.Points = { threshold: 0.08 };
    const pointer = new THREE.Vector2();

    function pickPoint(event: PointerEvent): void {
      if (mode !== 'edit' || !cloudRef.current || !onPickPoint) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -(((event.clientY - rect.top) / rect.height) * 2 - 1)
      );
      raycaster.setFromCamera(pointer, camera);
      const [hit] = raycaster.intersectObject(cloudRef.current, false);
      if (!hit) return;
      onPickPoint({
        mode: 'native_3d',
        x: Number(hit.point.x.toFixed(4)),
        y: Number(hit.point.y.toFixed(4)),
        z: Number(hit.point.z.toFixed(4)),
        ...(hit.face?.normal ? {
          normal: {
            x: Number(hit.face.normal.x.toFixed(4)),
            y: Number(hit.face.normal.y.toFixed(4)),
            z: Number(hit.face.normal.z.toFixed(4))
          }
        } : {}),
        camera: {
          position: toTuple(camera.position),
          target: toTuple(controls.target)
        }
      });
    }

    renderer.domElement.addEventListener('pointerdown', pickPoint);

    function updateProjectedHotspots(): void {
      const rect = renderer.domElement.getBoundingClientRect();
      const next = nativeHotspots.map((hotspot) => {
        const position = hotspot.position as Native3dPosition;
        const vector = new THREE.Vector3(position.x, position.y, position.z).project(camera);
        return {
          id: hotspot.id,
          label: hotspot.label,
          left: ((vector.x + 1) / 2) * rect.width,
          top: ((-vector.y + 1) / 2) * rect.height,
          visible: vector.z >= -1 && vector.z <= 1
        };
      });
      setProjectedHotspots(next);
    }

    function onResize(): void {
      const nextWidth = containerElement.clientWidth || 800;
      const nextHeight = containerElement.clientHeight || 520;
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(nextWidth, nextHeight);
    }

    window.addEventListener('resize', onResize);

    function animate(): void {
      frameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
      updateProjectedHotspots();
    }
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointerdown', pickPoint);
      controls.dispose();
      scene.traverse((object) => {
        const mesh = object as THREE.Points;
        mesh.geometry?.dispose?.();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) material.forEach((item) => item.dispose());
        else material?.dispose?.();
      });
      renderer.dispose();
      if (containerElement.contains(renderer.domElement)) containerElement.removeChild(renderer.domElement);
      rendererRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      cloudRef.current = null;
      sceneRef.current = null;
    };
  }, [assetUrl, mode, nativeHotspots, onPickPoint]);

  function resetView(): void {
    const view = initialViewRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!view || !camera || !controls) return;
    camera.position.copy(view.position);
    controls.target.copy(view.target);
    controls.update();
  }

  return (
    <div className={`relative h-full min-h-[360px] w-full overflow-hidden bg-black ${className}`}>
      <div ref={containerRef} className="h-full w-full" />
      <div className="pointer-events-none absolute inset-0">
        {projectedHotspots.map((hotspot) => hotspot.visible ? (
          <button
            key={hotspot.id}
            type="button"
            onClick={() => onHotspotClick(hotspot.id)}
            className={`pointer-events-auto absolute flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-[10px] font-black shadow-xl ring-4 ring-black/20 transition hover:scale-110 ${activeHotspotId === hotspot.id ? 'bg-ip-accent text-white' : 'bg-white text-slate-950'}`}
            style={{ left: hotspot.left, top: hotspot.top }}
            title={hotspot.label}
          >
            3D
          </button>
        ) : null)}
      </div>
      <div className="absolute right-3 top-3 flex gap-2">
        <button type="button" onClick={resetView} className="rounded-full bg-white px-3 py-2 text-[10px] font-black text-slate-950 shadow-lg">
          Reset view
        </button>
        {mode === 'edit' ? (
          <span className="rounded-full bg-violet-500 px-3 py-2 text-[10px] font-black text-white shadow-lg">
            Click para asignar 3D
          </span>
        ) : null}
      </div>
      {status === 'loading' ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <p className="rounded-full bg-white px-4 py-2 text-xs font-black text-slate-950">Cargando PLY...</p>
        </div>
      ) : null}
      {status === 'error' ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/85 p-6 text-center">
          <p className="max-w-sm text-sm font-bold leading-6 text-white/75">{errorMessage}</p>
        </div>
      ) : null}
    </div>
  );
}
