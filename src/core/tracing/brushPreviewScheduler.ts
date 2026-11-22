import type { BrushSample } from "./vectorBrush";

/** Abstract frame clock so batching and cancellation are deterministic in tests. */
export interface BrushFrameClock {
  request(callback: () => void): number;
  cancel(id: number): void;
}
export interface BrushPreviewScheduler {
  enqueue(samples: readonly BrushSample[]): void;
  clear(): void;
  dispose(): void;
}

/**
 * Keep the complete incoming pen samples in a separate mutable trace buffer.
 * Only React preview publications are coalesced to the display frame.
 * Do not use this scheduler's last published preview for final SVG geometry.
 */
export function createBrushPreviewScheduler(
  publish: (samples: BrushSample[]) => void,
  clock: BrushFrameClock = {
    request: (callback) => requestAnimationFrame(callback),
    cancel: (id) => cancelAnimationFrame(id),
  },
): BrushPreviewScheduler {
  let latest: readonly BrushSample[] | null = null;
  let frame: number | null = null;
  let epoch = 0;
  let disposed = false;

  const clear = () => {
    epoch++;
    latest = null;
    if (frame !== null) {
      clock.cancel(frame);
      frame = null;
    }
  };
  return {
    enqueue(samples) {
      if (disposed) return;
      latest = samples;
      if (frame !== null) return;
      const scheduledEpoch = epoch;
      frame = clock.request(() => {
        if (disposed || scheduledEpoch !== epoch) return;
        frame = null;
        const ready = latest;
        latest = null;
        if (ready) publish([...ready]);
      });
    },
    clear,
    dispose() {
      if (disposed) return;
      clear();
      disposed = true;
    },
  };
}
