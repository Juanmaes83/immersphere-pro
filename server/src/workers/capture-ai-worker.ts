import os from 'node:os';
import { env } from '../config/env.js';
import {
  executeCaptureAiProcessingRun,
  lockNextQueuedCaptureAiRun,
  recoverStaleCaptureAiRuns
} from '../services/capture-ai-processing.service.js';

type WorkerHandle = {
  stop: () => void;
};

let workerHandle: WorkerHandle | null = null;

function resolveWorkerId(): string {
  return env.CAPTURE_AI_WORKER_ID.trim() || `${os.hostname()}-${process.pid}`;
}

export function startCaptureAiWorker(): WorkerHandle | null {
  if (!env.CAPTURE_AI_WORKER_ENABLED) {
    process.stdout.write('Capture AI worker disabled by CAPTURE_AI_WORKER_ENABLED=false\n');
    return null;
  }
  if (workerHandle) return workerHandle;

  const workerId = resolveWorkerId();
  let running = false;
  let stopped = false;
  let lastRecoveryAt = 0;

  async function tick(): Promise<void> {
    if (running || stopped) return;
    running = true;
    try {
      const now = Date.now();
      if (now - lastRecoveryAt > Math.max(env.CAPTURE_AI_RUN_STALE_MINUTES * 60_000, env.CAPTURE_AI_WORKER_INTERVAL_MS)) {
        lastRecoveryAt = now;
        const recovered = await recoverStaleCaptureAiRuns();
        if (recovered.requeued || recovered.failed) {
          process.stdout.write(`Capture AI worker recovered stale runs: requeued=${recovered.requeued} failed=${recovered.failed}\n`);
        }
      }

      for (let index = 0; index < env.CAPTURE_AI_WORKER_CONCURRENCY; index += 1) {
        const run = await lockNextQueuedCaptureAiRun(workerId);
        if (!run) break;
        await executeCaptureAiProcessingRun(run.id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`Capture AI worker tick failed: ${message}\n`);
    } finally {
      running = false;
    }
  }

  const interval = setInterval(() => {
    void tick();
  }, env.CAPTURE_AI_WORKER_INTERVAL_MS);
  void tick();

  workerHandle = {
    stop() {
      stopped = true;
      clearInterval(interval);
      workerHandle = null;
    }
  };
  process.stdout.write(`Capture AI worker started: id=${workerId} intervalMs=${env.CAPTURE_AI_WORKER_INTERVAL_MS} concurrency=${env.CAPTURE_AI_WORKER_CONCURRENCY}\n`);
  return workerHandle;
}
