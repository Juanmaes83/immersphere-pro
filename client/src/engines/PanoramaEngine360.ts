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
  private animationFrameId: number | null = null;
  private isDisposed = false;
  private isPointerDown = false;
  private pointerStartX = 0;
  private pointerStartY = 0;
  private startYaw = 0;
  private startPitch = 0;
  private yaw: number;
  private pitch: number;
  private fov: number;

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

    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handleWheel = this.handleWheel.bind(this);

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

  public dispose(): void {
    this.isDisposed = true;

    if (this.animationFrameId !== null) {
      window.cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

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
    const tick = (): void => {
      if (this.isDisposed) return;

      this.render();
      this.animationFrameId = window.requestAnimationFrame(tick);
    };

    tick();
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

  private handlePointerMove(event: PointerEvent): void {
    if (!this.isPointerDown) return;

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
