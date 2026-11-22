import { describe, expect, it } from "vitest";
import { createBrushPreviewScheduler, type BrushFrameClock } from "../brushPreviewScheduler";
import { appendBrushSamples, vectorBrushOutline, DEFAULT_BRUSH, type BrushSample } from "../vectorBrush";

function fakeClock() {
  let counter = 0;
  const scheduled = new Map<number, () => void>();
  const cancelled: number[] = [];
  const clock: BrushFrameClock = {
    request(callback) {
      const id = ++counter;
      scheduled.set(id, callback);
      return id;
    },
    cancel(id) {
      cancelled.push(id);
      scheduled.delete(id);
    },
  };
  const tick = () => {
    const callbacks = [...scheduled.values()];
    scheduled.clear();
    callbacks.forEach(callback => callback());
  };
  return { clock, tick, scheduled, cancelled };
}
const sample = (x: number): BrushSample => ({
  x, y: Math.sin(x / 12) * 6, pressure: 0.25 + (x % 5) / 10,
});

describe("frame-coalesced brush preview vs full-resolution SVG trace", () => {
  it("coalesces many pen events into one current frame while retaining newest preview", () => {
    const frames = fakeClock();
    const published: BrushSample[][] = [];
    const scheduler = createBrushPreviewScheduler(data => published.push(data), frames.clock);
    for (let x = 0; x < 40; x++) scheduler.enqueue([sample(0), sample(x)]);
    expect(frames.scheduled.size).toBe(1);
    expect(published).toEqual([]);
    frames.tick();
    expect(published).toHaveLength(1);
    expect(published[0]?.at(-1)?.x).toBe(39);
    scheduler.enqueue([sample(0), sample(100)]);
    expect(frames.scheduled.size).toBe(1);
    frames.tick();
    expect(published).toHaveLength(2);
    expect(published[1]?.at(-1)?.x).toBe(100);
    scheduler.dispose();
  });

  it("cancels pending callbacks on pen-up, interruption, and component disposal", () => {
    const frames = fakeClock();
    const published: BrushSample[][] = [];
    const scheduler = createBrushPreviewScheduler(data => published.push(data), frames.clock);
    scheduler.enqueue([sample(1)]);
    const oldCallback = [...frames.scheduled.values()][0]!;
    scheduler.clear();
    expect(frames.scheduled.size).toBe(0);
    // An already-queued browser callback may still run after cancellation.
    oldCallback();
    expect(published).toEqual([]);
    scheduler.enqueue([sample(2)]);
    frames.tick();
    expect(published).toEqual([[sample(2)]]);
    scheduler.enqueue([sample(3)]);
    const late = [...frames.scheduled.values()][0]!;
    scheduler.dispose();
    late();
    scheduler.enqueue([sample(4)]);
    frames.tick();
    expect(published).toEqual([[sample(2)]]);
    expect(frames.cancelled).toHaveLength(2);
  });

  it("reentrant pen events schedule the next frame without losing the previous frame", () => {
    const frames = fakeClock();
    const published: number[] = [];
    let scheduler: ReturnType<typeof createBrushPreviewScheduler>;
    scheduler = createBrushPreviewScheduler(data => {
      published.push(data.at(-1)!.x);
      if (data.at(-1)!.x === 1) scheduler.enqueue([sample(2)]);
    }, frames.clock);
    scheduler.enqueue([sample(1)]);
    frames.tick();
    expect(published).toEqual([1]);
    expect(frames.scheduled.size).toBe(1);
    frames.tick();
    expect(published).toEqual([1, 2]);
  });

  it("final vector always uses full sampled trace, never the last published preview", () => {
    const frames = fakeClock();
    let preview: BrushSample[] = [];
    const scheduler = createBrushPreviewScheduler(data => { preview = data; }, frames.clock);
    let full: BrushSample[] = [];
    for (let x = 0; x <= 130; x++) {
      full = appendBrushSamples(full, [sample(x)], 1);
      scheduler.enqueue(full);
      if (x === 30) frames.tick();
    }
    // On pen-up the full trace includes all later samples even if no new frame fired.
    expect(preview.at(-1)?.x).toBe(30);
    expect(full.at(-1)?.x).toBe(130);
    scheduler.clear();
    frames.tick();
    expect(preview.at(-1)?.x).toBe(30);
    const shape = vectorBrushOutline(full, DEFAULT_BRUSH)!;
    expect(shape.points.length).toBe(full.length * 2);
    expect(shape.closed).toBe(true);
    scheduler.dispose();
  });
});
