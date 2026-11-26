import { describe, expect, it } from "vitest";
import {
  brushPreviewBudget, brushPreviewSamples, vectorBrushPreviewOutline,
} from "../brushPreview";
import { DEFAULT_BRUSH, vectorBrushOutline } from "../vectorBrush";
import { geometryToPathData } from "../../../objects/render";

const longStroke = Array.from({ length: 2301 }, (_, x) => ({
  x,
  y: x === 900 ? 85 : x === 901 ? 40 : Math.sin(x / 50) * 5,
  pressure: x === 1700 ? 1 : 0.35,
}));

describe("bounded vector brush preview versus final saved outline", () => {
  it("reduces expensive live SVG geometry while keeping important pressure and corner extrema", () => {
    for (const zoom of [0.6, 2, 6]) {
      const samples = brushPreviewSamples(longStroke, zoom);
      expect(samples).toHaveLength(brushPreviewBudget(zoom));
      expect(samples[0]).toEqual(longStroke[0]);
      expect(samples.at(-1)).toEqual(longStroke.at(-1));
      expect(samples.some(p => p.x === 900 && p.y === 85)).toBe(true);
      expect(samples.some(p => p.x === 1700 && p.pressure === 1)).toBe(true);
      const preview = vectorBrushPreviewOutline(longStroke, DEFAULT_BRUSH, zoom)!;
      const saved = vectorBrushOutline(longStroke, DEFAULT_BRUSH)!;
      expect(preview.closed).toBe(true);
      expect(preview.points.length).toBeLessThanOrEqual(2 * brushPreviewBudget(zoom));
      expect(saved.points.length).toBeLessThanOrEqual(longStroke.length * 2);
      expect(preview.points.length).toBeGreaterThanOrEqual(4);
      expect(preview.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))).toBe(true);
      expect(geometryToPathData(preview)).not.toMatch(/NaN|Infinity/);
      expect(geometryToPathData(saved)).not.toMatch(/NaN|Infinity/);
    }
    expect(longStroke).toHaveLength(2301);
    expect(longStroke[900]?.y).toBe(85);
  });

  it("adjusts preview detail to actual canvas zoom without changing the saved path", () => {
    expect(brushPreviewBudget(0.5)).toBe(384);
    expect(brushPreviewBudget(1.5)).toBe(576);
    expect(brushPreviewBudget(3.99)).toBe(576);
    expect(brushPreviewBudget(4)).toBe(768);
    const exactBefore=vectorBrushOutline(longStroke, DEFAULT_BRUSH);
    const low = vectorBrushPreviewOutline(longStroke, DEFAULT_BRUSH, 0.6)!;
    const high = vectorBrushPreviewOutline(longStroke, DEFAULT_BRUSH, 6)!;
    expect(brushPreviewSamples(longStroke,6).length).toBeGreaterThan(brushPreviewSamples(longStroke,.6).length);
    expect(high.closed&&low.closed).toBe(true);
    const exact = vectorBrushOutline(longStroke, DEFAULT_BRUSH)!;
    expect(exact).toEqual(exactBefore);
    expect(brushPreviewSamples(longStroke,.6)).not.toEqual(brushPreviewSamples(longStroke,6));
  });

  it("keeps short brush marks identical to final outlines for all presets", () => {
    const short = longStroke.slice(0, 30);
    for (const preset of ["round", "qalam", "taper"] as const) {
      const settings = { ...DEFAULT_BRUSH, preset };
      const preview = vectorBrushPreviewOutline(short, settings, 1)!;
      const final = vectorBrushOutline(short, settings)!;
      expect(preview).toEqual(final);
      expect(preview.points.length).toBeGreaterThanOrEqual(4);
      expect(preview.points.length).toBeLessThanOrEqual(60);
    }
    const dot = [longStroke[0]!];
    expect(vectorBrushPreviewOutline(dot, DEFAULT_BRUSH, 1))
      .toEqual(vectorBrushOutline(dot, DEFAULT_BRUSH));
  });

  it("does not publish malformed zoom previews or mutate user drawing input", () => {
    for (const zoom of [0, NaN, Infinity, -1]) {
      expect(brushPreviewBudget(zoom)).toBe(0);
      expect(brushPreviewSamples(longStroke, zoom)).toEqual([]);
      expect(vectorBrushPreviewOutline(longStroke, DEFAULT_BRUSH, zoom)).toBeNull();
    }
    const originalFirst = { ...longStroke[0]! };
    const originalLast = { ...longStroke.at(-1)! };
    brushPreviewSamples(longStroke, 0.8);
    expect(longStroke[0]).toEqual(originalFirst);
    expect(longStroke.at(-1)).toEqual(originalLast);
    expect(vectorBrushPreviewOutline([], DEFAULT_BRUSH, 1)).toBeNull();
  });
});
