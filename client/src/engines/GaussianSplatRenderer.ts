import * as THREE from 'three';
import {
  SparkRenderer,
  SplatMesh,
  SplatEdit,
  SplatEditSdf,
  SplatEditSdfType,
  SplatEditRgbaBlendMode,
  SparkControls
} from '@sparkjsdev/spark';
import type {
  GaussianSplatRendererConfig,
  GaussianSplatViewState,
  RendererLifecycle
} from '@/types/viewer';

export class GaussianSplatRenderer implements RendererLifecycle {
  private readonly container: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly threeRenderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly spark: SparkRenderer;
  private readonly controls: SparkControls;
  private readonly onReady?: () => void;
  private readonly onError?: (error: Error) => void;
  private readonly onViewChange?: (state: GaussianSplatViewState) => void;

  private splatMesh: SplatMesh | null = null;
  private sdfEdits: SplatEdit[] = [];
  private isDisposed = false;
  private currentAssetUrl: string | null = null;
  private lastTime = 0;

  public constructor(config: GaussianSplatRendererConfig) {
    this.container = config.container;
    this.onReady = config.onReady;
    this.onError = config.onError;
    this.onViewChange = config.onViewChange;

    this.canvas = document.createElement('canvas');
    this.canvas.tabIndex = 0;
    this.canvas.className = 'h-full w-full outline-none';
    this.container.innerHTML = '';
    this.container.appendChild(this.canvas);

    this.threeRenderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false });
    this.threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.threeRenderer.setSize(this.container.clientWidth || 800, this.container.clientHeight || 520);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x030408);

    this.camera = new THREE.PerspectiveCamera(
      60,
      (this.container.clientWidth || 800) / (this.container.clientHeight || 520),
      0.01,
      1000
    );
    this.camera.position.set(
      config.initialPosition?.x ?? 0,
      config.initialPosition?.y ?? 0,
      config.initialPosition?.z ?? 2.8
    );

    this.spark = new SparkRenderer({ renderer: this.threeRenderer });
    this.scene.add(this.spark);

    this.controls = new SparkControls({
      canvas: this.canvas,
      moveSpeed: 1.7,
      rotateSpeed: 2.0
    } as ConstructorParameters<typeof SparkControls>[0]);

    // Three.js r170 types use XRFrameRequestCallback; cast avoids overload mismatch
    (this.threeRenderer as unknown as { setAnimationLoop: (cb: ((t: number) => void) | null) => void })
      .setAnimationLoop((time) => this.animate(time));
  }

  private animate(time: number): void {
    if (this.isDisposed) return;
    const dt = Math.min((time - this.lastTime) / 1000, 0.1);
    this.lastTime = time;
    // SparkControls TS types diverge from documented API; cast avoids mismatch
    (this.controls as unknown as { update: (dt: number, cam: { position: THREE.Vector3; quaternion: THREE.Quaternion }) => void })
      .update(dt, { position: this.camera.position, quaternion: this.camera.quaternion });
    this.threeRenderer.render(this.scene, this.camera);
    this.emitViewChange();
  }

  public async load(assetUrl?: string): Promise<void> {
    const sourceUrl = assetUrl ?? '';
    if (!sourceUrl) {
      this.emitError(new Error('No se ha proporcionado URL de Gaussian Splat.'));
      return;
    }
    if (this.isDisposed) return;

    this.currentAssetUrl = sourceUrl;
    this.removeCurrentSplat();

    let loadResolved = false;

    // Guard against stalled loads (incompatible PLY format, silent network errors)
    // where neither onLoad nor initialized.catch ever fires.
    const loadTimeoutId = setTimeout(() => {
      if (!loadResolved && !this.isDisposed) {
        this.emitError(
          new Error(
            'Tiempo de carga agotado (30 s). Verifica que el archivo sea un Gaussian Splat válido (.splat o PLY con propiedades 3DGS) y que la URL sea accesible.'
          )
        );
      }
    }, 30_000);

    const splat = new SplatMesh({
      url: sourceUrl,
      onLoad: () => {
        loadResolved = true;
        clearTimeout(loadTimeoutId);
        if (!this.isDisposed) this.onReady?.();
      }
    });

    splat.position.set(0, -0.65, 0);
    splat.rotation.set(Math.PI, 0, 0);
    this.scene.add(splat);
    this.splatMesh = splat;

    splat.initialized.catch((err: unknown) => {
      clearTimeout(loadTimeoutId);
      if (this.isDisposed || loadResolved) return;
      const message = err instanceof Error ? err.message : 'No se pudo cargar el Gaussian Splat.';
      this.emitError(new Error(message));
    });
  }

  public addSdfSphere(screenX: number, screenY: number): void {
    if (!this.splatMesh) return;

    const ndcX = (screenX / 100) * 2 - 1;
    const ndcY = -((screenY / 100) * 2 - 1);

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);

    const pos = raycaster.ray.origin.clone().addScaledVector(raycaster.ray.direction, 1.5);

    const edit = new SplatEdit({
      rgbaBlendMode: SplatEditRgbaBlendMode.MULTIPLY,
      sdfSmooth: 0.05,
      sdfs: [
        new SplatEditSdf({
          type: SplatEditSdfType.SPHERE,
          radius: 0.3,
          opacity: 0.0,
          color: new THREE.Color(1, 1, 1)
        })
      ]
    });
    edit.position.copy(pos);
    this.splatMesh.add(edit);
    this.sdfEdits.push(edit);
  }

  public clearSdfEdits(): void {
    for (const edit of this.sdfEdits) {
      this.splatMesh?.remove(edit);
    }
    this.sdfEdits = [];
  }

  public resize(): void {
    if (this.isDisposed) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.threeRenderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  public dispose(): void {
    this.isDisposed = true;
    (this.threeRenderer as unknown as { setAnimationLoop: (cb: null) => void }).setAnimationLoop(null);
    this.removeCurrentSplat();
    this.spark.dispose();
    this.threeRenderer.dispose();
    if (this.canvas.parentElement === this.container) {
      this.container.removeChild(this.canvas);
    }
  }

  public setYaw(_value: number): void { /* controlled by SparkControls */ }
  public setPitch(_value: number): void { /* controlled by SparkControls */ }

  /**
   * Adjusts SparkControls move/rotate speeds at runtime.
   * SparkControls reads these properties every frame, so property mutation is sufficient.
   */
  public setSpeed(moveSpeed: number, rotateSpeed: number): void {
    const c = this.controls as unknown as { moveSpeed: number; rotateSpeed: number };
    c.moveSpeed  = moveSpeed;
    c.rotateSpeed = rotateSpeed;
  }

  public setPosition(x: number, y: number, z: number): void {
    this.camera.position.set(x, y, z);
  }

  public getViewState(): GaussianSplatViewState {
    return {
      position: {
        x: this.camera.position.x,
        y: this.camera.position.y,
        z: this.camera.position.z
      },
      yaw: 0,
      pitch: 0
    };
  }

  public getPoint3D(
    relX: number,
    relY: number,
    containerWidth: number,
    containerHeight: number
  ): { x: number; y: number; z: number } {
    const ndcX = (relX / containerWidth) * 2 - 1;
    const ndcY = -((relY / containerHeight) * 2 - 1);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    const pos = raycaster.ray.origin.clone().addScaledVector(raycaster.ray.direction, 1.5);
    return { x: pos.x, y: pos.y, z: pos.z };
  }

  private removeCurrentSplat(): void {
    if (this.splatMesh) {
      this.clearSdfEdits();
      this.scene.remove(this.splatMesh);
      this.splatMesh.dispose();
      this.splatMesh = null;
    }
  }

  private emitViewChange(): void {
    this.onViewChange?.(this.getViewState());
  }

  private emitError(error: Error): void {
    this.onError?.(error);
  }

  public getAssetUrl(): string | null {
    return this.currentAssetUrl;
  }
}

export default GaussianSplatRenderer;
