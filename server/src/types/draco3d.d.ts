/**
 * Minimal type declarations for the `draco3d` package.
 * draco3d exposes WASM modules for encoding/decoding Draco-compressed geometry.
 */
declare module 'draco3d' {
  interface DracoModule {
    [key: string]: unknown;
  }

  const draco3d: {
    createDecoderModule(config?: Record<string, unknown>): Promise<DracoModule>;
    createEncoderModule(config?: Record<string, unknown>): Promise<DracoModule>;
  };

  export default draco3d;
}
