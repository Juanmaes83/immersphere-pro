import * as pc from 'playcanvas';
import type {
  GaussianSplatRendererConfig,
  GaussianSplatViewState,
  RendererLifecycle
} from '@/types/viewer';

export class GaussianSplatRenderer implements RendererLifecycle {
  private readonly container: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly app: pc.Application;
  private readonly camera: pc.Entity;
  private readonly onReady?: () => void;
  private readonly onError?: (error: Error) => void;
  private readonly onViewChange?: (state: GaussianSplatViewState) => void;

  private splatEntity: pc.Entity | null = null;
  private splatAsset: pc.Asset | null = null;
  private isDisposed = false;
  private isPointerDown = false;
  private pointerStartX = 0;
  private pointerStartY = 0;
  private startYaw = 0;
  private startPitch = 0;
  private yaw: number;
  private pitch: number;
  private position: pc.Vec3;
  private pressedKeys = new Set<string>();

  public constructor(config: GaussianSplatRendererConfig) {
    this.container = config.container;
    this.onReady = config.onReady;
    this.onError = config.onError;
    this.onViewChange = config.onViewChange;
    this.yaw = config.initialYaw ?? 0;
    this.pitch = config.initialPitch ?? -8;
    this.position = new pc.Vec3(
      config.initialPosition?.x ?? 0,
      config.initialPosition?.y ?? 0,
      config.initialPosition?.z ?? 2.8
    );

    this.canvas = document.createElement('canvas');
    this.canvas.tabIndex = 0;
    this.canvas.className = 'h-full w-full outline-none';

    this.container.innerHTML = '';
    this.container.appendChild(this.canvas);

    this.app = new pc.Application(this.canvas, {
      graphicsDeviceOptions: {
        antialias: false,
        powerPreference: 'high-performance'
      }
    });

    this.app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    this.app.setCanvasResolution(pc.RESOLUTION_AUTO);
    this.app.start();

    this.camera = new pc.Entity('Immersphere Splat Camera');
    this.camera.addComponent('camera', {
      clearColor: new pc.Color(0.015, 0.018, 0.03)
    });
    this.app.root.addChild(this.camera);
    this.updateCameraTransform();

    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.handleUpdate = this.handleUpdate.bind(this);

    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    this.app.on('update', this.handleUpdate);
  }

  public async load(assetUrl?: string): Promise<void> {
    const sourceUrl = assetUrl ?? '';

    if (!sourceUrl) {
      this.emitError(new Error('No se ha proporcionado URL de Gaussian Splat.'));
      return;
    }

    if (this.isDisposed) return;

    this.removeCurrentSplat();

    await new Promise<void>((resolve) => {
      const asset = new pc.Asset('Immersphere Gaussian Splat', 'gsplat', {
        url: sourceUrl
      });

      this.splatAsset = asset;
      this.app.assets.add(asset);

      const handleAssetReady = (): void => {
        if (this.isDisposed) {
          resolve();
          return;
        }

        const splat = new pc.Entity('Immersphere Splat Entity');
        splat.setPosition(0, -0.65, 0);
        splat.setEulerAngles(0, 0, 180);
        splat.addComponent('gsplat', {
          asset
        });

        this.splatEntity = splat;
        this.app.root.addChild(splat);
        this.onReady?.();
        resolve();
      };

      const handleAssetError = (error: unknown): void => {
        const message = typeof error === 'string' ? error : 'No se pudo cargar el Gaussian Splat.';
        this.emitError(new Error(message));
        resolve();
      };

      asset.ready(handleAssetReady);
      asset.once('error', handleAssetError);
      this.app.assets.load(asset);
    });
  }

  public resize(): void {
    if (this.isDisposed) return;
    this.app.resizeCanvas();
  }

  public dispose(): void {
    this.isDisposed = true;

    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    this.app.off('update', this.handleUpdate);

    this.removeCurrentSplat();
    this.camera.destroy();
    this.app.destroy();

    if (this.canvas.parentElement === this.container) {
      this.container.removeChild(this.canvas);
    }
  }

  public setYaw(value: number): void {
    this.yaw = value;
    this.updateCameraTransform();
    this.emitViewChange();
  }

  public setPitch(value: number): void {
    this.pitch = Math.max(-85, Math.min(85, value));
    this.updateCameraTransform();
    this.emitViewChange();
  }

  public setPosition(x: number, y: number, z: number): void {
    this.position.set(x, y, z);
    this.updateCameraTransform();
    this.emitViewChange();
  }

  public getViewState(): GaussianSplatViewState {
    return {
      position: {
        x: this.position.x,
        y: this.position.y,
        z: this.position.z
      },
      yaw: this.yaw,
      pitch: this.pitch
    };
  }

  private removeCurrentSplat(): void {
    if (this.splatEntity) {
      this.splatEntity.destroy();
      this.splatEntity = null;
    }

    if (this.splatAsset) {
      this.splatAsset.unload();
      this.app.assets.remove(this.splatAsset);
      this.splatAsset = null;
    }
  }

  private handlePointerDown(event: PointerEvent): void {
    this.canvas.focus();
    this.isPointerDown = true;
    this.pointerStartX = event.clientX;
    this.pointerStartY = event.clientY;
    this.startYaw = this.yaw;
    this.startPitch = this.pitch;
    this.canvas.setPointerCapture(event.pointerId);
  }

  private handlePointerMove(event: PointerEvent): void {
    if (!this.isPointerDown) return;

    const deltaX = event.clientX - this.pointerStartX;
    const deltaY = event.clientY - this.pointerStartY;

    this.setYaw(this.startYaw - deltaX * 0.16);
    this.setPitch(this.startPitch + deltaY * 0.16);
  }

  private handlePointerUp(event: PointerEvent): void {
    this.isPointerDown = false;

    if (this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }
  }

  private handleKeyDown(event: KeyboardEvent): void {
    this.pressedKeys.add(event.key.toLowerCase());
  }

  private handleKeyUp(event: KeyboardEvent): void {
    this.pressedKeys.delete(event.key.toLowerCase());
  }

  private handleUpdate(deltaTime: number): void {
    if (this.pressedKeys.size === 0) return;

    const speed = 1.7 * deltaTime;
    const yawRad = (this.yaw * Math.PI) / 180;
    const forward = new pc.Vec3(Math.sin(yawRad), 0, -Math.cos(yawRad));
    const right = new pc.Vec3(Math.cos(yawRad), 0, Math.sin(yawRad));
    const move = new pc.Vec3();

    if (this.pressedKeys.has('w')) move.add(forward);
    if (this.pressedKeys.has('s')) move.sub(forward);
    if (this.pressedKeys.has('d')) move.add(right);
    if (this.pressedKeys.has('a')) move.sub(right);
    if (this.pressedKeys.has('q')) move.y += 1;
    if (this.pressedKeys.has('e')) move.y -= 1;

    if (move.lengthSq() > 0) {
      move.normalize().mulScalar(speed);
      this.position.add(move);
      this.updateCameraTransform();
      this.emitViewChange();
    }
  }

  private updateCameraTransform(): void {
    this.camera.setPosition(this.position);
    this.camera.setEulerAngles(this.pitch, this.yaw, 0);
  }

  private emitViewChange(): void {
    this.onViewChange?.(this.getViewState());
  }

  private emitError(error: Error): void {
    this.onError?.(error);
  }
}

export default GaussianSplatRenderer;
