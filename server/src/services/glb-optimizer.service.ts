/**
 * GLB Optimizer Service
 *
 * Optimiza archivos .glb ANTES de subirlos a Cloudinary usando @gltf-transform:
 *   - dedup()      → elimina recursos duplicados (texturas, accessors)
 *   - flatten()    → colapsa la jerarquía de nodos redundantes
 *   - weld()       → fusiona vértices idénticos
 *   - draco()      → comprime geometría con Draco WASM (~70-90% reducción)
 *   - textureCompress() → convierte texturas a WebP (requiere sharp, opcional)
 *
 * Si la optimización falla o supera el timeout de 60 s, devuelve null para que
 * el caller use el archivo original como fallback.
 */

import { readFile, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { dedup, draco, flatten, textureCompress, weld } from '@gltf-transform/functions';
import { KHRONOS_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3d';

const OPTIMIZATION_TIMEOUT_MS = 60_000;

export interface GlbOptimizationResult {
  optimizedPath: string;
  originalBytes: number;
  optimizedBytes: number;
  /** 0-1 float, e.g. 0.72 means 72% smaller */
  compressionRatio: number;
}

async function loadSharp(): Promise<typeof import('sharp') | null> {
  try {
    const s = await import('sharp');
    // Verify it actually works (native binary loaded)
    return s.default ?? (s as unknown as typeof import('sharp'));
  } catch {
    return null;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`GLB optimization timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err)   => { clearTimeout(timer); reject(err); }
    );
  });
}

async function optimizeGlb(sourcePath: string, originalBytes: number): Promise<GlbOptimizationResult> {
  // Build NodeIO with Draco support
  const decoderModule = await draco3d.createDecoderModule();
  const encoderModule = await draco3d.createEncoderModule();

  const io = new NodeIO()
    .registerExtensions(KHRONOS_EXTENSIONS)
    .registerDependencies({
      'draco3d.decoder': decoderModule,
      'draco3d.encoder': encoderModule
    });

  const document = await io.read(sourcePath);

  // Core geometry transforms
  await document.transform(
    dedup(),
    flatten(),
    weld()
  );

  // Draco compression
  await document.transform(
    draco({ method: 'edgebreaker', encodeSpeed: 5, decodeSpeed: 5 })
  );

  // WebP texture compression (optional — graceful skip if sharp unavailable)
  const sharpLib = await loadSharp();
  if (sharpLib) {
    try {
      await document.transform(
        textureCompress({
          encoder: sharpLib,
          targetFormat: 'webp',
          resize: [2048, 2048]
        })
      );
    } catch {
      // WebP conversion failed — keep original textures, Draco still applied
    }
  }

  // Write optimized GLB to a new temp file
  const tempDir = os.tmpdir();
  const outputFilename = `glb-opt-${Date.now()}-${Math.random().toString(16).slice(2)}.glb`;
  const outputPath = path.join(tempDir, outputFilename);

  const glbBuffer = await io.writeBinary(document);
  await writeFile(outputPath, glbBuffer);

  const optimizedBytes = glbBuffer.byteLength;
  const compressionRatio = originalBytes > 0
    ? Math.max(0, 1 - optimizedBytes / originalBytes)
    : 0;

  return {
    optimizedPath: outputPath,
    originalBytes,
    optimizedBytes,
    compressionRatio
  };
}

/**
 * Optimizes a GLB file and returns the result, or null if optimization
 * fails / times out (caller should fall back to the original file).
 */
export async function tryOptimizeGlb(
  sourcePath: string,
  originalBytes: number
): Promise<GlbOptimizationResult | null> {
  try {
    const result = await withTimeout(optimizeGlb(sourcePath, originalBytes), OPTIMIZATION_TIMEOUT_MS);

    // Sanity check: if the "optimized" file is actually larger, skip it
    if (result.optimizedBytes >= originalBytes) {
      await unlink(result.optimizedPath).catch(() => undefined);
      return null;
    }

    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[glb-optimizer] Optimization skipped:', message);
    return null;
  }
}
