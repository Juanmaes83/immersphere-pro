import * as THREE from 'three';
import type { PanoramaEngineConfig, PanoramaViewState, RendererLifecycle } from '@/types/viewer';

export class PanoramaEngine360 implements RendererLifecycle {
  private readonly container: HTMLDivElement;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly textureLoader: THREE.TextureLoader;
  private readonly minFov: number;
  private readonly maxFov: number;
  private readonly onReady?: () => void;
  private readonly onError?: (error: Error) => void;
  private readonly onViewChange?: (state: PanoramaViewState) => void;

  private mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial> | null = null;
  private isDisposed = false;
  private isPointerDown = false;
  private pointerStartX = 0;
  private pointerStartY = 0;
  private startYaw = 0;
  private startPitch = 0;
  private yaw: number;
  private pitch: number;
  private fov: number;
  private gyroscopeActive = false;
  private xrSession: XRSession | null = null;

  public constructor(config: PanoramaEngineConfig) {
    this.container = config.container;
    this.scene = new THREE.Scene();
    this.textureLoader = new THREE.TextureLoader();

    this.yaw = config.initialYaw ?? 0;
    this.pitch = config.initialPitch ?? 0;
    this.fov = config.initialFov ?? 75;
    this.minFov = config.minFov ?? 35;
    this.maxFov = config.maxFov ?? 95;
    this.onReady = config.onReady;
    this.onError = config.onError;
    this.onViewChange = config.onViewChange;

    const { width, height } = this.getContainerSize();

    this.camera = new THREE.PerspectiveCamera(this.fov, width / height, 0.1, 1100);
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.xr.enabled = true;

    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handleWheel = this.handleWheel.bind(this);
    this.handleDeviceOrientation = this.handleDeviceOrientation.bind(this);

    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
    this.renderer.domElement.addEventListener('wheel', this.handleWheel, { passive: false });

    this.updateCamera();
  }

  public async load(assetUrl?: string): Promise<void> {
    const imageUrl = assetUrl ?? '';

    if (!imageUrl) {
      this.emitError(new Error('No se ha proporcionado URL de panorama.'));
      return;
    }

    try {
      const texture = await this.loadTexture(imageUrl);

      if (this.isDisposed) {
        texture.dispose();
        return;
      }

      texture.colorSpace = THREE.SRGBColorSpace;

      const geometry = new THREE.SphereGeometry(500, 96, 64);
      geometry.scale(-1, 1, 1);

      const material = new THREE.MeshBasicMaterial({
        map: texture
      });

      if (this.mesh) {
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.map?.dispose();
        this.mesh.material.dispose();
      }

      this.mesh = new THREE.Mesh(geometry, material);
      this.scene.add(this.mesh);

      this.startRenderLoop();
      this.onReady?.();
    } catch (error) {
      this.emitError(error instanceof Error ? error : new Error('Error cargando panorama.'));
    }
  }

  public resize(): void {
    if (this.isDisposed) return;

    const { width, height } = this.getContainerSize();

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.render();
  }

  public async enableGyroscope(onDenied?: () => void): Promise<void> {
    if (this.gyroscopeActive || this.isDisposed) return;

    // iOS 13+ requires explicit user permission
    const DOE = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
    if (typeof DOE.requestPermission === 'function') {
      try {
        const permission = await DOE.requestPermission();
        if (permission !== 'granted') {
          onDenied?.();
          return;
        }
      } catch {
        onDenied?.();
        return;
      }
    }

    this.gyroscopeActive = true;
    window.addEventListener('deviceorientation', this.handleDeviceOrientation, true);
  }

  public disableGyroscope(): void {
    if (!this.gyroscopeActive) return;
    this.gyroscopeActive = false;
    window.removeEventListener('deviceorientation', this.handleDeviceOrientation, true);
  }

  public isGyroscopeActive(): boolean {
    return this.gyroscopeActive;
  }

  public getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  public async enterVR(onSessionEnd?: () => void): Promise<void> {
    if (!navigator.xr || this.xrSession || this.isDisposed) return;

    const session = await navigator.xr.requestSession('immersive-vr', {
      optionalFeatures: ['local-floor', 'bounded-floor']
    });

    this.xrSession = session;
    await this.renderer.xr.setSession(session);

    session.addEventListener('end', () => {
      this.xrSession = null;
      onSessionEnd?.();
    });
  }

  public async exitVR(): Promise<void> {
    if (!this.xrSession) return;
    await this.xrSession.end();
    this.xrSession = null;
  }

  public isInVR(): boolean {
    return this.xrSession !== null;
  }

  public dispose(): void {
    this.isDisposed = true;

    this.renderer.setAnimationLoop(null);

    if (this.xrSession) {
      void this.xrSession.end().catch(() => {});
      this.xrSession = null;
    }

    this.disableGyroscope();
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointerDown);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    this.renderer.domElement.removeEventListener('wheel', this.handleWheel);

    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.map?.dispose();
      this.mesh.material.dispose();
      this.mesh = null;
    }

    this.renderer.dispose();

    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }

  public setYaw(value: number): void {
    this.yaw = value;
    this.updateCamera();
    this.emitViewChange();
  }

  public setPitch(value: number): void {
    this.pitch = THREE.MathUtils.clamp(value, -85, 85);
    this.updateCamera();
    this.emitViewChange();
  }

  public setFov(value: number): void {
    this.fov = THREE.MathUtils.clamp(value, this.minFov, this.maxFov);
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();
    this.emitViewChange();
  }

  public getViewState(): PanoramaViewState {
    return {
      yaw: this.yaw,
      pitch: this.pitch,
      fov: this.fov
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
    const dir = raycaster.ray.direction.clone().normalize().multiplyScalar(500);
    return { x: dir.x, y: dir.y, z: dir.z };
  }

  private loadTexture(imageUrl: string): Promise<THREE.Texture> {
    return new Promise((resolve, reject) => {
      this.textureLoader.load(
        imageUrl,
        (texture) => resolve(texture),
        undefined,
        () => reject(new Error(`No se pudo cargar la textura 360: ${imageUrl}`))
      );
    });
  }

  private startRenderLoop(): void {
    // setAnimationLoop is required for WebXR — it replaces requestAnimationFrame
    // and lets the browser's XR compositor drive the frame rate in immersive mode.
    this.renderer.setAnimationLoop(() => {
      if (this.isDisposed) {
        this.renderer.setAnimationLoop(null);
        return;
      }
      this.render();
    });
  }

  private render(): void {
    if (this.isDisposed) return;
    this.renderer.render(this.scene, this.camera);
  }

  private updateCamera(): void {
    const phi = THREE.MathUtils.degToRad(90 - this.pitch);
    const theta = THREE.MathUtils.degToRad(this.yaw);

    const target = new THREE.Vector3(
      500 * Math.sin(phi) * Math.cos(theta),
      500 * Math.cos(phi),
      500 * Math.sin(phi) * Math.sin(theta)
    );

    this.camera.lookAt(target);
  }

  private handlePointerDown(event: PointerEvent): void {
    this.isPointerDown = true;
    this.pointerStartX = event.clientX;
    this.pointerStartY = event.clientY;
    this.startYaw = this.yaw;
    this.startPitch = this.pitch;
    this.renderer.domElement.setPointerCapture(event.pointerId);
  }

  private handleDeviceOrientation(event: DeviceOrientationEvent): void {
    if (!this.gyroscopeActive || this.isDisposed) return;

    const alpha = event.alpha ?? 0;
    const beta = event.beta ?? 90;
    const gamma = event.gamma ?? 0;
    const screenAngle = screen.orientation?.angle ?? 0;

    let newYaw: number;
    let newPitch: number;

    if (Math.abs(screenAngle) === 90 || Math.abs(screenAngle) === 270) {
      // Landscape orientation
      newYaw = -alpha;
      newPitch = THREE.MathUtils.clamp(gamma < 0 ? -beta : beta, -85, 85);
    } else {
      // Portrait orientation (default)
      newYaw = -alpha;
      newPitch = THREE.MathUtils.clamp(90 - beta, -85, 85);
    }

    this.yaw = newYaw;
    this.pitch = newPitch;
    this.updateCamera();
    this.emitViewChange();
  }

  private handlePointerMove(event: PointerEvent): void {
    if (!this.isPointerDown || this.gyroscopeActive) return;

    const deltaX = event.clientX - this.pointerStartX;
    const deltaY = event.clientY - this.pointerStartY;

    this.setYaw(this.startYaw - deltaX * 0.12);
    this.setPitch(this.startPitch + deltaY * 0.12);
  }

  private handlePointerUp(event: PointerEvent): void {
    this.isPointerDown = false;

    if (this.renderer.domElement.hasPointerCapture(event.pointerId)) {
      this.renderer.domElement.releasePointerCapture(event.pointerId);
    }
  }

  private handleWheel(event: WheelEvent): void {
    event.preventDefault();
    this.setFov(this.fov + event.deltaY * 0.04);
  }

  private getContainerSize(): { width: number; height: number } {
    const width = Math.max(this.container.clientWidth, 320);
    const height = Math.max(this.container.clientHeight, 240);

    return { width, height };
  }

  private emitViewChange(): void {
    this.onViewChange?.(this.getViewState());
  }

  private emitError(error: Error): void {
    this.onError?.(error);
  }
}

export default PanoramaEngine360;
