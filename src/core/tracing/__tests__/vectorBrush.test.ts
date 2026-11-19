import { describe, expect, it } from "vitest";
import { appendBrushSamples, brushPressure, vectorBrushOutline, DEFAULT_BRUSH } from "../vectorBrush";
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

  it("rejects malformed configurations and oversized or nonfinite paths safely", () => {
    expect(vectorBrushOutline(samples, { ...DEFAULT_BRUSH, size: NaN })).toBeNull();
    expect(vectorBrushOutline([{ x: Infinity, y: 0, pressure: 1 }], DEFAULT_BRUSH)).toBeNull();
    expect(vectorBrushOutline(Array.from({ length: 3001 }, (_, i) =>
      ({ x: i, y: 0, pressure: 1 })), DEFAULT_BRUSH)).toBeNull();
  });
});
