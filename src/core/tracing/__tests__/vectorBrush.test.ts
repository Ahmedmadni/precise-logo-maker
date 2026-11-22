import { describe, expect, it } from "vitest";
import { appendBrushSamples, brushPressure, vectorBrushOutline, thinBrushSamples, DEFAULT_BRUSH } from "../vectorBrush";
import { geometryToPathData } from "../../../objects/render";

const samples = [
  { x: 20, y: 30, pressure: 0.2 },
  { x: 35, y: 30, pressure: 0.5 },
  { x: 50, y: 30, pressure: 1 },
  { x: 65, y: 35, pressure: 0.5 },
  { x: 80, y: 45, pressure: 0.2 },
];

describe("pressure-aware editable vector brushes", () => {
  it("generates closed, fillable silhouettes for three presets", () => {
    for (const preset of ["round", "qalam", "taper"] as const) {
      const shape = vectorBrushOutline(samples, { ...DEFAULT_BRUSH, preset });
      expect(shape).not.toBeNull();
      expect(shape?.closed).toBe(true);
      expect(shape?.points.length).toBe(samples.length * 2);
      const path = geometryToPathData(shape!);
      expect(path.startsWith("M ")).toBe(true);
      expect(path.endsWith("Z")).toBe(true);
      expect(path).not.toMatch(/NaN|Infinity/);
    }
  });

  it("really varies stroke geometry with nib direction", () => {
    const low = vectorBrushOutline(samples, { ...DEFAULT_BRUSH, preset: "qalam", angle: -65 })!;
    const high = vectorBrushOutline(samples, { ...DEFAULT_BRUSH, preset: "qalam", angle: 40 })!;
    expect(geometryToPathData(low)).not.toEqual(geometryToPathData(high));
  });

  it("reacts to pen pressure but behaves consistently for mouse or touch", () => {
    expect(brushPressure(0, "mouse")).toBeCloseTo(0.68);
    expect(brushPressure(0.2, "touch")).toBeCloseTo(0.68);
    expect(brushPressure(0.88, "pen")).toBeCloseTo(0.88);
    const responsive = vectorBrushOutline(samples, { ...DEFAULT_BRUSH, preset: "round" })!;
    const uniform = vectorBrushOutline(samples, { ...DEFAULT_BRUSH, preset: "round", pressure: false })!;
    expect(geometryToPathData(responsive)).not.toEqual(geometryToPathData(uniform));
  });

  it("creates a printable round SVG dot from a single round-brush tap", () => {
    const dot = vectorBrushOutline([samples[0]!], { ...DEFAULT_BRUSH, preset: "round" })!;
    expect(dot.points).toHaveLength(20);
    expect(dot.closed).toBe(true);
  });

  it("smooths jitter without relocating first and last sample", () => {
    const raw = [
      { x: 0, y: 0, pressure: 0.4 },
      { x: 10, y: 6, pressure: 0.4 },
      { x: 20, y: 0, pressure: 0.4 },
    ];
    const rough = vectorBrushOutline(raw, { ...DEFAULT_BRUSH, preset: "round", smoothing: 0 })!;
    const smooth = vectorBrushOutline(raw, { ...DEFAULT_BRUSH, preset: "round", smoothing: 0.8 })!;
    expect(geometryToPathData(rough)).not.toEqual(geometryToPathData(smooth));
    expect(smooth.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
  });

  it("draws an actual angled flat qalam dab instead of a round dot", () => {
    const tap = [{ x: 50, y: 50, pressure: 0.8 }];
    const circle = vectorBrushOutline(tap, { ...DEFAULT_BRUSH, preset: "round" })!;
    const flat = vectorBrushOutline(tap, { ...DEFAULT_BRUSH, preset: "qalam", angle: 0 })!;
    const upright = vectorBrushOutline(tap, { ...DEFAULT_BRUSH, preset: "qalam", angle: 90 })!;
    const tip = vectorBrushOutline(tap, { ...DEFAULT_BRUSH, preset: "taper" })!;
    expect(circle.points).toHaveLength(20);
    expect(flat.points).toHaveLength(8);
    expect(tip.points).toHaveLength(4);
    const size = (v: typeof flat) => ({
      width: Math.max(...v.points.map((pt) => pt.x)) - Math.min(...v.points.map((pt) => pt.x)),
      height: Math.max(...v.points.map((pt) => pt.y)) - Math.min(...v.points.map((pt) => pt.y)),
    });
    expect(size(flat).width).toBeGreaterThan(size(flat).height * 3);
    expect(size(upright).height).toBeGreaterThan(size(upright).width * 3);
    expect(geometryToPathData(flat)).not.toMatch(/NaN|Infinity/);
  });

  it("respects the physical chisel nib direction: perpendicular is thick, parallel is thin", () => {
    const line = [
      { x: 0, y: 30, pressure: 0.7 },
      { x: 25, y: 30, pressure: 0.7 },
      { x: 50, y: 30, pressure: 0.7 },
      { x: 75, y: 30, pressure: 0.7 },
      { x: 100, y: 30, pressure: 0.7 },
    ];
    const thickness = (angle: number) => {
      const shape = vectorBrushOutline(line, {
        ...DEFAULT_BRUSH, size: 18, angle, pressure: false, smoothing: 0,
      })!;
      return Math.abs(shape.points[2]!.y - shape.points[7]!.y);
    };
    expect(thickness(90)).toBeGreaterThan(thickness(0) * 4);
    expect(thickness(-90)).toBeCloseTo(thickness(90), 7);
  });

  it("uses geometric distance for tapered caps, not the number of coalesced pointer events", () => {
    const points = (xs: number[]) => xs.map((x) => ({ x, y: 40, pressure: 0.8 }));
    const uniform = vectorBrushOutline(points([0, 25, 50, 75, 100]), {
      ...DEFAULT_BRUSH, preset: "taper", pressure: false, smoothing: 0,
    })!;
    const uneven = vectorBrushOutline(points([0, 1, 3, 25, 50, 75, 100]), {
      ...DEFAULT_BRUSH, preset: "taper", pressure: false, smoothing: 0,
    })!;
    const u = uniform.points[1]!.y;
    const v = uneven.points[3]!.y;
    expect(v).toBeCloseTo(u, 6);
    expect(uneven.points[1]!.y).not.toBeCloseTo(u, 1);
  });

  it("preserves last pointer position, deduplicates coalesced events and limits memory", () => {
    const first = [{ x: 0, y: 0, pressure: 0.5 }];
    const seq = appendBrushSamples(first, [
      { x: 0.03, y: 0, pressure: 0.6 },
      { x: 2, y: 0, pressure: 0.6 },
      { x: 2.04, y: 0, pressure: 0.6 },
      { x: 7, y: 0, pressure: 0.7 },
    ], 2);
    expect(seq).toHaveLength(3);
    expect(seq[1]).toMatchObject({ x: 2 });
    const finished = appendBrushSamples(seq, [{ x: 7.18, y: 0, pressure: 0.7 }], 2, true);
    expect(finished).toHaveLength(3);
    expect(finished.at(-1)!.x).toBeCloseTo(7.18, 8);
    expect(seq.at(-1)!.x).toBe(7);
    expect(appendBrushSamples(first, [{ x: NaN, y: 0, pressure: 0.3 }], 1)).toEqual(first);
    expect(appendBrushSamples(first, [{ x: 8, y: 0, pressure: 0.6 }], 1, false, 1))
      .toEqual(first);
    expect(appendBrushSamples(first, [{ x: 8, y: 0, pressure: 0.6 }], 1, true, 1)[0]!.x).toBe(8);
  });

  it("thins full stylus trails without dropping sharp corners or pressure peaks", () => {
    const dense = Array.from({ length: 901 }, (_, i) => ({
      x: i,
      y: i === 300 ? 45 : 0,
      pressure: i === 650 ? 1 : 0.35,
    }));
    const reduced = thinBrushSamples(dense, 160, 1);
    expect(reduced.length).toBe(160);
    expect(reduced[0]).toEqual(dense[0]);
    expect(reduced.at(-1)).toEqual(dense.at(-1));
    expect(reduced.some(s => s.x === 300 && s.y === 45)).toBe(true);
    expect(reduced.some(s => s.x === 650 && s.pressure === 1)).toBe(true);
    expect(reduced.every(s => Number.isFinite(s.x) && Number.isFinite(s.pressure))).toBe(true);
    // The reducer is deterministic, independent of external UI state.
    expect(thinBrushSamples(dense, 160, 1)).toEqual(reduced);
  });

  it("keeps recording very long tablet strokes past the sample cap", () => {
    const maxSamples = 96;
    let trail: ReturnType<typeof appendBrushSamples> = [];
    for (let offset = 0; offset < 4200; offset += 84) {
      const incoming = Array.from({ length: 84 }, (_, index) => {
        const x = offset + index;
        return { x, y: x === 2100 ? 65 : Math.sin(x / 60) * 6,
          pressure: x === 3070 ? 1 : 0.45 };
      });
      trail = appendBrushSamples(trail, incoming, 1, false, maxSamples);
      expect(trail.length).toBeLessThanOrEqual(maxSamples);
    }
    expect(trail[0]?.x).toBe(0);
    expect(trail.at(-1)?.x).toBe(4199);
    expect(trail.some(s => s.x > 3500)).toBe(true);
    expect(trail.some(s => s.x === 2100 && s.y === 65)).toBe(true);
    const finished = appendBrushSamples(trail,
      [{ x: 4200.06, y: Math.sin(4200.06 / 60) * 6, pressure: 0.45 }],
      1, true, maxSamples);
    expect(finished.at(-1)?.x).toBeCloseTo(4200.06, 5);
    expect(finished.length).toBeLessThanOrEqual(maxSamples);
    const shape = vectorBrushOutline(finished, {
      ...DEFAULT_BRUSH, preset: "qalam", smoothing: 0.1,
    })!;
    expect(shape.closed).toBe(true);
    expect(shape.points.length).toBeGreaterThan(40);
    expect(geometryToPathData(shape)).not.toMatch(/NaN|Infinity/);
  });

  it("retains legacy tiny sample caps and rejects invalid thinning", () => {
    const first = [{ x: 0, y: 0, pressure: 0.5 }];
    expect(appendBrushSamples(first, [{ x: 30, y: 0, pressure: 0.8 }], 1, false, 1))
      .toEqual(first);
    expect(appendBrushSamples(first, [{ x: 30, y: 0, pressure: 0.8 }], 1, true, 1))
      .toEqual([{ x: 30, y: 0, pressure: 0.8 }]);
    expect(thinBrushSamples(first, 0, 1)).toEqual(first);
    expect(thinBrushSamples(first, 2, 0)).toEqual(first);
    expect(thinBrushSamples([{ x: NaN, y: 0, pressure: 1 }, ...first], 2, 1))
      .toHaveLength(2);
  });

  it("provides flat, soft and sharply pointed start/end profiles without changing the main body", () => {
    const line = [0, 15, 30, 45, 60, 75, 90].map((x) => ({ x, y: 25, pressure: 1 }));
    const geometry = (endStyle: "flat" | "soft" | "sharp") =>
      vectorBrushOutline(line, { ...DEFAULT_BRUSH, preset: "round", pressure: false, smoothing: 0, size: 20, endStyle })!;
    const flat = geometry("flat");
    const soft = geometry("soft");
    const sharp = geometry("sharp");
    const half = (shape: typeof flat, index: number) => Math.abs(shape.points[index]!.y - 25);
    expect(half(flat, 0)).toBeCloseTo(10, 5);
    expect(half(soft, 0)).toBeCloseTo(3.8, 5);
    expect(half(sharp, 0)).toBeCloseTo(0.8, 5);
    expect(half(sharp, 3)).toBeCloseTo(half(flat, 3), 5);
    expect(half(soft, 3)).toBeCloseTo(half(flat, 3), 5);
    expect(half(sharp, 6)).toBeCloseTo(half(sharp, 0), 5);
    expect(geometryToPathData(flat)).not.toBe(geometryToPathData(sharp));
  });

  it("handles sharp changes of direction with a bounded miter and finite corners", () => {
    const line = [
      { x: 0, y: 0, pressure: 1 },
      { x: 40, y: 0, pressure: 1 },
      { x: 40, y: 40, pressure: 1 },
    ];
    const stroke = vectorBrushOutline(line, {
      ...DEFAULT_BRUSH, preset: "round", pressure: false, smoothing: 0, size: 20,
    })!;
    expect(stroke.points).toHaveLength(6);
    expect(stroke.points[1]).toMatchObject({ x: 30, y: 10 });
    expect(stroke.points[4]).toMatchObject({ x: 50, y: -10 });
    const center = line[1]!;
    expect(Math.hypot(stroke.points[1]!.x - center.x, stroke.points[1]!.y - center.y))
      .toBeLessThanOrEqual(16.5001);
    for (const tail of [{ x: 10, y: 0 }, { x: 0.1, y: 0.01 }, { x: 43, y: -4 }]) {
      const folded = vectorBrushOutline([line[0]!, line[1]!, { ...tail, pressure: 1 }], {
        ...DEFAULT_BRUSH, preset: "round", pressure: false, smoothing: 0, size: 20,
      })!;
      expect(folded.points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true);
      expect(Math.hypot(folded.points[1]!.x - center.x, folded.points[1]!.y - center.y))
        .toBeLessThanOrEqual(16.5001);
    }
  });

  it("keeps legacy settings valid and rejects unsupported endpoint styles", () => {
    const legacy = { ...DEFAULT_BRUSH };
    delete legacy.endStyle;
    const restored = vectorBrushOutline(samples, legacy);
    const flat = vectorBrushOutline(samples, { ...DEFAULT_BRUSH, endStyle: "flat" });
    expect(geometryToPathData(restored!)).toBe(geometryToPathData(flat!));
    expect(vectorBrushOutline(samples, { ...DEFAULT_BRUSH, endStyle: "triangle" as "flat" }))
      .toBeNull();
  });

  it("rejects malformed configurations and oversized or nonfinite paths safely", () => {
    expect(vectorBrushOutline(samples, { ...DEFAULT_BRUSH, size: NaN })).toBeNull();
    expect(vectorBrushOutline([{ x: Infinity, y: 0, pressure: 1 }], DEFAULT_BRUSH)).toBeNull();
    expect(vectorBrushOutline(Array.from({ length: 3001 }, (_, i) =>
      ({ x: i, y: 0, pressure: 1 })), DEFAULT_BRUSH)).toBeNull();
  });
});
