import * as THREE from 'three';
import type { PanoramaEngineConfig, PanoramaViewState, RendererLifecycle } from '@/types/viewer';

// ── Physics constants ────────────────────────────────────────────────────────
/** Degrees rotated per pixel of drag */
const DRAG_SENS = 0.12;
/** Inertia friction per 16 ms frame — lower = longer glide (0.88 ≈ Matterport feel) */
const INERTIA_FRICTION = 0.88;
/** Stop inertia when velocity drops below this threshold (deg/ms) */
const INERTIA_STOP = 0.0008;
/** FOV change per pixel of pinch-distance delta */
const PINCH_SENS = 0.10;

export class PanoramaEngine360 implements RendererLifecycle {
  private readonly container: HTMLDivElement;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly textureLoader: THREE.TextureLoader;
  private readonly minFov: number;
  private readonly maxFov: number;
  private readonly onReady?: () => void;
  private readonly onPreviewReady?: () => void;
  private readonly onError?: (error: Error) => void;
  private readonly onViewChange?: (state: PanoramaViewState) => void;

  private mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial> | null = null;
  private isDisposed = false;
  private gyroscopeActive = false;
  private xrSession: XRSession | null = null;

  private yaw: number;
  private pitch: number;
  private fov: number;

  // ── Drag state ───────────────────────────────────────────────────────────────
  private isPointerDown = false;
  private pointerStartX = 0;
  private pointerStartY = 0;
  private startYaw = 0;
  private startPitch = 0;
  /** Previous frame pointer position for per-frame velocity computation */
  private lastPointerX = 0;
  private lastPointerY = 0;
  private lastMoveTs = 0;

  // ── Inertia ──────────────────────────────────────────────────────────────────
  /** Current angular velocity in degrees/ms — set on pointerUp, decays with friction */
  private velocityYaw = 0;
  private velocityPitch = 0;
  private inertiaRafId = 0;

  // ── Multi-pointer / pinch-zoom ───────────────────────────────────────────────
  /** Tracks all active pointer positions keyed by pointerId */
  private activePointers = new Map<number, { x: number; y: number }>();
  private lastPinchDist = 0;
  private isPinching = false;

  // ── Animated FOV ─────────────────────────────────────────────────────────────
  private fovAnimRafId = 0;
  /** Wheel zoom accumulates toward this target for smooth continuous scroll */
  private fovWheelTarget: number | null = null;
  private fovWheelRafId = 0;

  // ────────────────────────────────────────────────────────────────────────────

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
    this.onPreviewReady = config.onPreviewReady;
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
    this.renderer.domElement.style.touchAction = 'none';

    // Bind handlers
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

  // ── Public API (unchanged surface) ──────────────────────────────────────────

  public async load(assetUrl?: string): Promise<void> {
    const imageUrl = assetUrl ?? '';

    if (!imageUrl) {
      this.emitError(new Error('No se ha proporcionado URL de panorama.'));
      return;
    }

    // ── Stage 1: fire-and-forget blurred preview (Cloudinary only) ───────────
    // Tiny q_15,w_256 version loads in ~50–150 ms and gives instant visual feedback.
    // If full-res arrives first the preview is discarded silently.
    const previewUrl = this.buildCloudinaryPreview(imageUrl);
    if (previewUrl) {
      this.loadTexture(previewUrl)
        .then((tex) => {
          // Discard preview if disposed or if full-res already arrived (mesh exists)
          if (this.isDisposed || this.mesh) { tex.dispose(); return; }
          tex.colorSpace = THREE.SRGBColorSpace;
          this.applyTexture(tex);
          this.startRenderLoop();
          // Notify the UI that a blurred preview is now visible in the canvas
          this.onPreviewReady?.();
        })
        .catch(() => { /* preview failure is silent — full-res follows */ });
    }

    // ── Stage 2: await full-resolution texture ────────────────────────────────
    try {
      const texture = await this.loadTexture(imageUrl);

      if (this.isDisposed) {
        texture.dispose();
        return;
      }

      texture.colorSpace = THREE.SRGBColorSpace;
      this.applyTexture(texture);
      this.startRenderLoop(); // safe to call again — replaces loop if preview had started it
      this.onReady?.();
    } catch (error) {
      this.emitError(error instanceof Error ? error : new Error('Error cargando panorama.'));
    }
  }

  /**
   * Apply a texture to the sphere — creates the mesh on first call,
   * swaps the texture in-place on subsequent calls (preview → full-res upgrade).
   * Disposes the old texture to prevent GPU memory leaks.
   */
  private applyTexture(texture: THREE.Texture): void {
    if (this.mesh) {
      // In-place swap: keep geometry, just replace the map
      const old = this.mesh.material.map;
      this.mesh.material.map = texture;
      this.mesh.material.needsUpdate = true;
      old?.dispose();
    } else {
      const geometry = new THREE.SphereGeometry(500, 96, 64);
      geometry.scale(-1, 1, 1);
      this.mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: texture }));
      this.scene.add(this.mesh);
    }
  }

  /**
   * Build a Cloudinary URL that serves a tiny (256px wide), heavily blurred,
   * low-quality preview. Returns null for non-Cloudinary or already-transformed URLs.
   *
   * Pattern: /upload/{optional-transforms}/v{version}/...
   * We insert our transforms only when the segment after /upload/ starts with v+digits.
   */
  private buildCloudinaryPreview(url: string): string | null {
    if (!url.includes('res.cloudinary.com')) return null;
    const uploadIdx = url.indexOf('/upload/');
    if (uploadIdx === -1) return null;
    const after = url.slice(uploadIdx + 8);
    // Only add transforms when the URL has no existing transforms (starts with version segment)
    if (!/^v\d/.test(after)) return null;
    const before = url.slice(0, uploadIdx + 8);
    return `${before}q_15,w_256,e_blur:800/${after}`;
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

    const DOE = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
    if (typeof DOE.requestPermission === 'function') {
      try {
        const permission = await DOE.requestPermission();
        if (permission !== 'granted') { onDenied?.(); return; }
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

  public isGyroscopeActive(): boolean { return this.gyroscopeActive; }

  public getRenderer(): THREE.WebGLRenderer { return this.renderer; }

  public async enterVR(onSessionEnd?: () => void): Promise<void> {
    if (!navigator.xr || this.xrSession || this.isDisposed) return;
    const session = await navigator.xr.requestSession('immersive-vr', {
      optionalFeatures: ['local-floor', 'bounded-floor']
    });
    this.xrSession = session;
    await this.renderer.xr.setSession(session);
    session.addEventListener('end', () => { this.xrSession = null; onSessionEnd?.(); });
  }

  public async exitVR(): Promise<void> {
    if (!this.xrSession) return;
    await this.xrSession.end();
    this.xrSession = null;
  }

  public isInVR(): boolean { return this.xrSession !== null; }

  public dispose(): void {
    this.isDisposed = true;
    // Cancel all animation loops
    cancelAnimationFrame(this.inertiaRafId);
    cancelAnimationFrame(this.fovAnimRafId);
    cancelAnimationFrame(this.fovWheelRafId);
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

  /** Instant FOV change — cancels any ongoing FOV animation */
  public setFov(value: number): void {
    cancelAnimationFrame(this.fovAnimRafId);
    cancelAnimationFrame(this.fovWheelRafId);
    this.fovWheelTarget = null;
    this.fov = THREE.MathUtils.clamp(value, this.minFov, this.maxFov);
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();
    this.emitViewChange();
  }

  /**
   * Smoothly animate the FOV to `target` over `durationMs` milliseconds
   * using an ease-out cubic curve. Used by zoom buttons for premium feel.
   */
  public animateFovTo(target: number, durationMs = 250): void {
    cancelAnimationFrame(this.fovAnimRafId);
    cancelAnimationFrame(this.fovWheelRafId);
    this.fovWheelTarget = null;

    const clamped = THREE.MathUtils.clamp(target, this.minFov, this.maxFov);
    const startFov = this.fov;
    const delta = clamped - startFov;
    if (Math.abs(delta) < 0.05) return;

    const startTs = performance.now();

    const tick = (now: number): void => {
      if (this.isDisposed) return;
      const t = Math.min((now - startTs) / durationMs, 1);
      // ease-out cubic: decelerates into the target
      const eased = 1 - Math.pow(1 - t, 3);
      this.fov = startFov + delta * eased;
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
      this.emitViewChange();
      if (t < 1) { this.fovAnimRafId = requestAnimationFrame(tick); }
    };

    this.fovAnimRafId = requestAnimationFrame(tick);
  }

  public getViewState(): PanoramaViewState {
    return { yaw: this.yaw, pitch: this.pitch, fov: this.fov };
  }

  public getPoint3D(
    relX: number, relY: number,
    containerWidth: number, containerHeight: number
  ): { x: number; y: number; z: number } {
    const ndcX = (relX / containerWidth) * 2 - 1;
    const ndcY = -((relY / containerHeight) * 2 - 1);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    const dir = raycaster.ray.direction.clone().normalize().multiplyScalar(500);
    return { x: dir.x, y: dir.y, z: dir.z };
  }

  // ── Private — rendering ──────────────────────────────────────────────────────

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
    this.renderer.setAnimationLoop(() => {
      if (this.isDisposed) { this.renderer.setAnimationLoop(null); return; }
      this.render();
    });
  }

  private render(): void {
    if (this.isDisposed) return;
    this.renderer.render(this.scene, this.camera);
  }

  private updateCamera(): void {
    const phi   = THREE.MathUtils.degToRad(90 - this.pitch);
    const theta = THREE.MathUtils.degToRad(this.yaw);
    const target = new THREE.Vector3(
      500 * Math.sin(phi) * Math.cos(theta),
      500 * Math.cos(phi),
      500 * Math.sin(phi) * Math.sin(theta)
    );
    this.camera.lookAt(target);
  }

  // ── Private — pointer handling ───────────────────────────────────────────────

  private handlePointerDown(event: PointerEvent): void {
    this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.renderer.domElement.setPointerCapture(event.pointerId);

    const count = this.activePointers.size;

    if (count === 1) {
      // Single finger / mouse — start drag, kill any running inertia
      this.isPointerDown = true;
      this.isPinching = false;
      this.pointerStartX = event.clientX;
      this.pointerStartY = event.clientY;
      this.startYaw = this.yaw;
      this.startPitch = this.pitch;
      this.lastPointerX = event.clientX;
      this.lastPointerY = event.clientY;
      this.lastMoveTs = performance.now();
      cancelAnimationFrame(this.inertiaRafId);
      this.velocityYaw = 0;
      this.velocityPitch = 0;
    } else if (count === 2) {
      // Second finger arrived — switch to pinch
      this.isPointerDown = false;
      this.isPinching = true;
      cancelAnimationFrame(this.inertiaRafId);
      this.velocityYaw = 0;
      this.velocityPitch = 0;
      this.lastPinchDist = this.computePinchDist();
    }
  }

  private handlePointerMove(event: PointerEvent): void {
    if (!this.activePointers.has(event.pointerId) || this.gyroscopeActive) return;

    this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    // ── Pinch zoom ─────────────────────────────────────────────────────────────
    if (this.isPinching && this.activePointers.size === 2) {
      const dist  = this.computePinchDist();
      const delta = this.lastPinchDist - dist; // positive = fingers closer = zoom OUT
      this.lastPinchDist = dist;
      const nextFov = THREE.MathUtils.clamp(this.fov + delta * PINCH_SENS, this.minFov, this.maxFov);
      // Direct set during active pinch for 1:1 responsiveness
      this.fov = nextFov;
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
      this.emitViewChange();
      return;
    }

    if (!this.isPointerDown) return;

    // ── Single-pointer drag ────────────────────────────────────────────────────
    const now = performance.now();
    const dt  = Math.max(now - this.lastMoveTs, 4); // floor at 4 ms

    // Per-frame delta → angular velocity (deg/ms)
    const fdx = event.clientX - this.lastPointerX;
    const fdy = event.clientY - this.lastPointerY;
    this.velocityYaw   = (-fdx * DRAG_SENS) / dt;
    this.velocityPitch = ( fdy * DRAG_SENS) / dt;

    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;
    this.lastMoveTs   = now;

    // Absolute position from drag-start (avoids accumulated float error)
    this.yaw   = this.startYaw - (event.clientX - this.pointerStartX) * DRAG_SENS;
    this.pitch = THREE.MathUtils.clamp(
      this.startPitch + (event.clientY - this.pointerStartY) * DRAG_SENS,
      -85, 85
    );
    this.updateCamera();
    this.emitViewChange();
  }

  private handlePointerUp(event: PointerEvent): void {
    this.activePointers.delete(event.pointerId);

    if (this.renderer.domElement.hasPointerCapture(event.pointerId)) {
      this.renderer.domElement.releasePointerCapture(event.pointerId);
    }

    if (this.activePointers.size === 0) {
      // All pointers lifted — launch inertia if we were dragging
      if (this.isPointerDown) {
        this.isPointerDown = false;
        this.startInertia();
      }
      this.isPinching = false;
    } else if (this.activePointers.size === 1 && this.isPinching) {
      // One finger lifted during pinch — stop pinch, don't resume drag
      this.isPinching = false;
      this.isPointerDown = false;
    }
  }

  private handleWheel(event: WheelEvent): void {
    event.preventDefault();
    // Accumulate the zoom target so rapid scrolling builds up smoothly
    const base = this.fovWheelTarget ?? this.fov;
    this.fovWheelTarget = THREE.MathUtils.clamp(base + event.deltaY * 0.04, this.minFov, this.maxFov);

    cancelAnimationFrame(this.fovAnimRafId);
    cancelAnimationFrame(this.fovWheelRafId);
    this.tickWheelFov();
  }

  private handleDeviceOrientation(event: DeviceOrientationEvent): void {
    if (!this.gyroscopeActive || this.isDisposed) return;

    const alpha = event.alpha ?? 0;
    const beta  = event.beta  ?? 90;
    const gamma = event.gamma ?? 0;
    const screenAngle = screen.orientation?.angle ?? 0;

    let newYaw: number;
    let newPitch: number;

    if (Math.abs(screenAngle) === 90 || Math.abs(screenAngle) === 270) {
      newYaw   = -alpha;
      newPitch = THREE.MathUtils.clamp(gamma < 0 ? -beta : beta, -85, 85);
    } else {
      newYaw   = -alpha;
      newPitch = THREE.MathUtils.clamp(90 - beta, -85, 85);
    }

    this.yaw   = newYaw;
    this.pitch = newPitch;
    this.updateCamera();
    this.emitViewChange();
  }

  // ── Private — physics ────────────────────────────────────────────────────────

  /**
   * Launch the inertia deceleration loop.
   * Called on pointerUp when there is residual angular velocity.
   * Frame-rate independent via dt-scaled friction.
   */
  private startInertia(): void {
    cancelAnimationFrame(this.inertiaRafId);
    if (this.isDisposed) return;
    if (Math.abs(this.velocityYaw) < INERTIA_STOP && Math.abs(this.velocityPitch) < INERTIA_STOP) return;

    let lastTs = performance.now();

    const tick = (now: number): void => {
      if (this.isDisposed || this.isPointerDown || this.isPinching) return;

      const dt = Math.min(now - lastTs, 50); // cap to prevent huge jump on tab-resume
      lastTs = now;

      // Apply current velocity
      this.yaw  += this.velocityYaw   * dt;
      this.pitch = THREE.MathUtils.clamp(this.pitch + this.velocityPitch * dt, -85, 85);
      this.updateCamera();
      this.emitViewChange();

      // Decay velocity — frame-rate independent: k = friction^(dt/16ms)
      const k = Math.pow(INERTIA_FRICTION, dt / 16);
      this.velocityYaw   *= k;
      this.velocityPitch *= k;

      if (Math.abs(this.velocityYaw) > INERTIA_STOP || Math.abs(this.velocityPitch) > INERTIA_STOP) {
        this.inertiaRafId = requestAnimationFrame(tick);
      }
    };

    this.inertiaRafId = requestAnimationFrame(tick);
  }

  /**
   * Smooth wheel-zoom loop: exponential approach toward fovWheelTarget.
   * Runs until within 0.05° of target. Each new wheel event resets the target.
   */
  private tickWheelFov(): void {
    if (this.isDisposed || this.fovWheelTarget === null) {
      this.fovWheelRafId = 0;
      return;
    }

    const delta = this.fovWheelTarget - this.fov;

    if (Math.abs(delta) < 0.05) {
      this.fov = this.fovWheelTarget;
      this.fovWheelTarget = null;
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
      this.emitViewChange();
      this.fovWheelRafId = 0;
      return;
    }

    // Move 20% of remaining gap per frame (~60 fps → smooth deceleration)
    this.fov += delta * 0.20;
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();
    this.emitViewChange();

    this.fovWheelRafId = requestAnimationFrame(() => this.tickWheelFov());
  }

  /** Euclidean distance between the two active touch points */
  private computePinchDist(): number {
    const pts = [...this.activePointers.values()];
    if (pts.length < 2) return 0;
    const [a, b] = pts as [{ x: number; y: number }, { x: number; y: number }];
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // ── Private — utilities ──────────────────────────────────────────────────────

  private getContainerSize(): { width: number; height: number } {
    return {
      width:  Math.max(this.container.clientWidth,  320),
      height: Math.max(this.container.clientHeight, 240),
    };
  }

  private emitViewChange(): void { this.onViewChange?.(this.getViewState()); }
  private emitError(error: Error): void { this.onError?.(error); }
}

export default PanoramaEngine360;
