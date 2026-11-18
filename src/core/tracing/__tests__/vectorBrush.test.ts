import { describe, expect, it } from "vitest";
import { brushPressure, vectorBrushOutline, DEFAULT_BRUSH } from "../vectorBrush";
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

  it("creates a printable SVG dot from a single pen tap", () => {
    const dot = vectorBrushOutline([samples[0]!], DEFAULT_BRUSH)!;
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

  it("rejects malformed configurations and oversized or nonfinite paths safely", () => {
    expect(vectorBrushOutline(samples, { ...DEFAULT_BRUSH, size: NaN })).toBeNull();
    expect(vectorBrushOutline([{ x: Infinity, y: 0, pressure: 1 }], DEFAULT_BRUSH)).toBeNull();
    expect(vectorBrushOutline(Array.from({ length: 3001 }, (_, i) =>
      ({ x: i, y: 0, pressure: 1 })), DEFAULT_BRUSH)).toBeNull();
  });
});
